/**
 * المشاريع: الربحية، وتكلفة الساعات، والإيراد غير المفوتَر.
 *
 * السؤال الذي يجيب عنه هذا الملف: هل يعرف النظام أن مشروعاً يخسر قبل أن
 * ينتهي؟ ولذلك يقيس الربح مرّتين — قبل تحميل ساعات العمل وبعده — لأن
 * الفرق بينهما هو الذي يقلب مشروعاً يبدو رابحاً إلى خاسر.
 */
import './setup.ts';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, withTenant } from '../src/lib/db.ts';
import { provisionTenant, purgeTenantBySlug } from '../src/lib/provisioning.ts';
import {
  createProject, logTime, approveTimesheets, projectProfitability,
  billableLinesFromTimesheets, markTimesheetsInvoiced, projectsOverview,
} from '../src/lib/projects/projects.ts';
import { createInvoice, postInvoice } from '../src/lib/sales/invoices.ts';
import { createBill, postBill } from '../src/lib/purchasing/bills.ts';
import { money, d } from '../src/lib/money.ts';

let tenantId: string;
let projectId: string;
let employeeId: string;
let customerId: string;
let vendorId: string;

const Y = new Date().getUTCFullYear();
const day = (m: number, dd: number) => new Date(Date.UTC(Y, m - 1, dd));

before(async () => {
  await purgeTenantBySlug('proj-test');
  const t = await provisionTenant({ slug: 'proj-test', nameAr: 'منشأة اختبار المشاريع' });
  tenantId = t.id;

  await withTenant(tenantId, async (tx) => {
    customerId = (await tx.partner.create({
      data: { tenantId, code: 'C-1', nameAr: 'عميل المشروع', isCustomer: true, vatNumber: '311111111101113' },
    })).id;
    vendorId = (await tx.partner.create({
      data: { tenantId, code: 'V-1', nameAr: 'مورّد', isCustomer: false, isVendor: true },
    })).id;
    employeeId = (await tx.employee.create({
      data: {
        tenantId, code: 'E-1', nameAr: 'مهندس المشروع', isSaudi: true,
        hireDate: day(1, 1),
        basicSalary: '18000', housingAllowance: '4500', transportAllowance: '1500',
      },
    })).id;

    const p = await createProject(tx, tenantId, {
      nameAr: 'تأسيس منشأة أجنبية — عميل المشروع',
      partnerId: customerId,
      startDate: day(1, 15),
      budget: 30_000,
      contractValue: 90_000,
      billableByHour: true,
      hourlyRate: 350,
    });
    projectId = p.id;
    await tx.project.update({ where: { id: p.id }, data: { status: 'ACTIVE' } });
  });
});

after(async () => {
  await purgeTenantBySlug('proj-test');
  await prisma.$disconnect();
});

test('المشروع يأخذ رمزاً متسلسلاً تلقائياً', async () => {
  await withTenant(tenantId, async (tx) => {
    const p = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    assert.match(p.code, /^PRJ-\d{4}-0001$/);
  });
});

test('سعر الساعة يُثبَّت لحظة التسجيل من سعر المشروع', async () => {
  await withTenant(tenantId, async (tx) => {
    const ts = await logTime(tx, tenantId, {
      employeeId, projectId, date: day(2, 3), hours: 6,
      descAr: 'إعداد ملف الاستثمار الأجنبي',
    });
    assert.equal(money(ts.rate).toFixed(2), '350.00');
  });
});

test('ساعات تتجاوز يوم عمل معقولاً تُرفض', async () => {
  await withTenant(tenantId, async (tx) => {
    await assert.rejects(
      () => logTime(tx, tenantId, { employeeId, projectId, date: day(2, 4), hours: 25 }),
      /راجِع الإدخال/,
    );
  });
});

test('مجموع ساعات اليوم عبر المشاريع محكوم كذلك', async () => {
  await withTenant(tenantId, async (tx) => {
    const other = await createProject(tx, tenantId, { nameAr: 'مشروع آخر', hourlyRate: 200 });
    await tx.project.update({ where: { id: other.id }, data: { status: 'ACTIVE' } });

    await logTime(tx, tenantId, { employeeId, projectId, date: day(2, 5), hours: 10 });
    await assert.rejects(
      () => logTime(tx, tenantId, { employeeId, projectId: other.id, date: day(2, 5), hours: 8 }),
      /سيصير 18/,
    );
  });
});

test('المشروع المنتهي لا تُسجَّل عليه ساعات', async () => {
  await withTenant(tenantId, async (tx) => {
    const done = await createProject(tx, tenantId, { nameAr: 'مشروع منتهٍ' });
    await tx.project.update({ where: { id: done.id }, data: { status: 'COMPLETED' } });

    await assert.rejects(
      () => logTime(tx, tenantId, { employeeId, projectId: done.id, date: day(2, 6), hours: 2 }),
      /لا تُسجَّل عليه ساعات/,
    );
  });
});

test('سعر الساعة يُشتقّ من أجر الموظف حين لا سعر للمشروع', async () => {
  await withTenant(tenantId, async (tx) => {
    const internal = await createProject(tx, tenantId, { nameAr: 'مشروع داخلي' });
    await tx.project.update({ where: { id: internal.id }, data: { status: 'ACTIVE' } });

    const ts = await logTime(tx, tenantId, {
      employeeId, projectId: internal.id, date: day(2, 7), hours: 4, billable: false,
    });
    // (١٨٠٠٠ + ٤٥٠٠ + ١٥٠٠) ÷ ٢٤٠ = ١٠٠
    assert.equal(money(ts.rate).toFixed(2), '100.00');
  });
});

test('الربحية تجمع الإيراد والتكلفة من الدفتر لا من الفواتير', async () => {
  await withTenant(tenantId, async (tx) => {
    const inv = await createInvoice(tx, tenantId, {
      partnerId: customerId, issueDate: day(3, 1), projectId,
      lines: [{ descAr: 'الدفعة الأولى — تأسيس منشأة أجنبية', qty: 1, unitPrice: 60_000 }],
    });
    await postInvoice(tx, tenantId, inv.id, 'tester');

    const bill = await createBill(tx, tenantId, {
      partnerId: vendorId, vendorRef: 'GOV-001', issueDate: day(3, 5), projectId,
      lines: [{ descAr: 'رسوم وزارة الاستثمار', qty: 1, unitPrice: 20_000, taxCodeId: null }],
    });
    await postBill(tx, tenantId, bill.id, 'tester');

    const perf = await projectProfitability(tx, tenantId, projectId);

    assert.equal(perf.revenue.toFixed(2), '60000.00', 'الإيراد بالوعاء لا بالإجمالي');
    assert.equal(perf.directCost.toFixed(2), '20000.00');
    assert.equal(perf.grossProfit.toFixed(2), '40000.00');
    assert.equal(perf.margin?.toFixed(2), '66.67');
  });
});

test('تكلفة الساعات تُعرض منفصلةً ليظهر الربح الحقيقي', async () => {
  await withTenant(tenantId, async (tx) => {
    const perf = await projectProfitability(tx, tenantId, projectId);

    // ٦ + ١٠ ساعات × ٣٥٠
    assert.equal(perf.totalHours.toFixed(2), '16.00');
    assert.equal(perf.laborCost.toFixed(2), '5600.00');

    // الربح قبل الساعات ٤٠٠٠٠ وبعدها ٣٤٤٠٠ — والفرق هو ما يُنسى عادةً
    assert.equal(perf.grossProfit.toFixed(2), '40000.00');
    assert.equal(perf.profitWithLabor.toFixed(2), '34400.00');
  });
});

test('تجاوز الميزانية يُرصد', async () => {
  await withTenant(tenantId, async (tx) => {
    const perf = await projectProfitability(tx, tenantId, projectId);
    // التكلفة ٢٠٠٠٠ والميزانية ٣٠٠٠٠
    assert.equal(perf.overBudget, false);
    assert.equal(perf.budgetUsedPercent?.toFixed(2), '66.67');

    const bill = await createBill(tx, tenantId, {
      partnerId: vendorId, vendorRef: 'GOV-002', issueDate: day(4, 1), projectId,
      lines: [{ descAr: 'رسوم إضافية', qty: 1, unitPrice: 15_000, taxCodeId: null }],
    });
    await postBill(tx, tenantId, bill.id, 'tester');

    const after = await projectProfitability(tx, tenantId, projectId);
    assert.equal(after.directCost.toFixed(2), '35000.00');
    assert.equal(after.overBudget, true, 'التكلفة تجاوزت الميزانية ولم يُرصد');
  });
});

test('الساعات غير المفوترة إيرادٌ منسيّ يظهر بقيمته', async () => {
  await withTenant(tenantId, async (tx) => {
    const perf = await projectProfitability(tx, tenantId, projectId);
    assert.equal(perf.unbilledValue.toFixed(2), '5600.00', '١٦ ساعة × ٣٥٠ لم تُفوتر');
    assert.equal(perf.utilization?.toFixed(2), '100.00', 'كل الساعات قابلة للفوترة');
  });
});

test('سطور الفاتورة تُبنى من الساعات المعتمدة وتُجمَّع بالسعر', async () => {
  await withTenant(tenantId, async (tx) => {
    // غير المعتمدة لا تدخل الفاتورة
    const before = await billableLinesFromTimesheets(tx, tenantId, projectId);
    assert.equal(before.lines.length, 0, 'الساعات غير المعتمدة لا تُفوتر');

    const sheets = await tx.timesheet.findMany({ where: { tenantId, projectId } });
    await approveTimesheets(tx, tenantId, sheets.map((s) => s.id), 'manager');

    const after = await billableLinesFromTimesheets(tx, tenantId, projectId);
    assert.equal(after.lines.length, 1, 'ساعتان بالسعر نفسه تُجمَّعان في سطر');
    assert.equal(after.lines[0].qty.toFixed(2), '16.00');
    assert.equal(after.lines[0].unitPrice.toFixed(2), '350.00');
    assert.equal(after.lines[0].uomCode, 'HUR');

    // بعد الفوترة تختفي من غير المفوتَر
    await markTimesheetsInvoiced(tx, tenantId, after.timesheetIds);
    const perf = await projectProfitability(tx, tenantId, projectId);
    assert.equal(perf.unbilledValue.toFixed(2), '0.00');
  });
});

test('لوحة المشاريع تعرض الحالة والربحية في نظرة واحدة', async () => {
  await withTenant(tenantId, async (tx) => {
    const rows = await projectsOverview(tx, tenantId);
    const main = rows.find((r) => r.id === projectId)!;

    assert.equal(main.nameAr, 'تأسيس منشأة أجنبية — عميل المشروع');
    assert.equal(main.partnerAr, 'عميل المشروع');
    assert.equal(main.revenue.toFixed(2), '60000.00');
    assert.equal(main.overBudget, true);
    assert.ok(rows.length >= 3, 'المشاريع الأخرى تظهر كذلك');
  });
});
