/**
 * الإقفال السنوي.
 *
 * السؤال الذي يجيب عنه هذا الملف: هل تبدأ السنة الجديدة نظيفة؟ أي هل صُفِّرت
 * الإيرادات والمصروفات، وانتقل صافيها إلى الأرباح المبقاة، وبقيت الميزانية
 * متوازنة قبل الإقفال وبعده؟
 */
import './setup.ts';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, withTenant } from '../src/lib/db.ts';
import { provisionTenant, purgeTenantBySlug } from '../src/lib/provisioning.ts';
import { postEntry, accountByRole, auditLedgerIntegrity } from '../src/lib/accounting/posting.ts';
import { previewClosing, closeFiscalYear, reverseClosing, openingBalances } from '../src/lib/accounting/closing.ts';
import { profitAndLoss, balanceSheet, generalLedger, trialBalance } from '../src/lib/accounting/reports.ts';
import { createFiscalYear } from '../src/lib/accounting/periods.ts';
import { money } from '../src/lib/money.ts';

let tenantId: string;
let fyId: string;
const Y = new Date().getUTCFullYear();
const day = (m: number, dd: number) => new Date(Date.UTC(Y, m - 1, dd));

before(async () => {
  await purgeTenantBySlug('closing-test');
  const t = await provisionTenant({ slug: 'closing-test', nameAr: 'منشأة اختبار الإقفال' });
  tenantId = t.id;

  await withTenant(tenantId, async (tx) => {
    fyId = (await tx.fiscalYear.findFirstOrThrow({ where: { tenantId } })).id;

    // رأس مال
    await postEntry(tx, tenantId, {
      date: day(1, 2), memoAr: 'رأس المال', sourceType: 'OPENING',
      lines: [
        { accountSubtype: 'BANK', debit: 300_000 },
        { accountCode: '3101', credit: 300_000 },
      ],
    });
    // إيراد ٢٠٠٬٠٠٠
    await postEntry(tx, tenantId, {
      date: day(3, 1), memoAr: 'إيراد خدمات',
      lines: [
        { accountSubtype: 'RECEIVABLE', debit: 200_000 },
        { accountSubtype: 'SERVICE_REVENUE', credit: 200_000 },
      ],
    });
    // مصروفات ١٢٠٬٠٠٠ على حسابين
    await postEntry(tx, tenantId, {
      date: day(4, 1), memoAr: 'رواتب',
      lines: [
        { accountSubtype: 'PAYROLL_BASIC', debit: 90_000 },
        { accountSubtype: 'BANK', credit: 90_000 },
      ],
    });
    await postEntry(tx, tenantId, {
      date: day(5, 1), memoAr: 'إيجار',
      lines: [
        { accountCode: '5210', debit: 30_000 },
        { accountSubtype: 'BANK', credit: 30_000 },
      ],
    });
  });
});

after(async () => {
  await purgeTenantBySlug('closing-test');
  await prisma.$disconnect();
});

test('المعاينة تعرض ما سيُقفل قبل أن يقع', async () => {
  await withTenant(tenantId, async (tx) => {
    const p = await previewClosing(tx, tenantId, fyId);

    assert.equal(p.alreadyClosed, false);
    assert.equal(p.totalRevenue.toFixed(2), '200000.00');
    assert.equal(p.totalExpense.toFixed(2), '120000.00');
    assert.equal(p.netProfit.toFixed(2), '80000.00');
    assert.equal(p.accountsToClose, 3, 'إيراد واحد ومصروفان');
    assert.equal(p.draftEntries, 0);
  });
});

test('قيدٌ مسوّد في السنة يمنع الإقفال', async () => {
  await withTenant(tenantId, async (tx) => {
    // نصنع قيداً مسوّداً مباشرةً (المحرّك يرحّل فوراً، فنكتبه يدوياً)
    const bank = await accountByRole(tx, tenantId, 'BANK');
    const cap = await tx.account.findFirstOrThrow({ where: { tenantId, code: '3101' } });
    const draft = await tx.journalEntry.create({
      data: {
        tenantId, number: 'JV-DRAFT-1', date: day(6, 1), status: 'DRAFT',
        totalDebit: '100', totalCredit: '100',
        lines: {
          create: [
            { tenantId, accountId: bank.id, debit: '100', credit: '0', sortOrder: 0 },
            { tenantId, accountId: cap.id, debit: '0', credit: '100', sortOrder: 1 },
          ],
        },
      },
    });

    await assert.rejects(
      () => closeFiscalYear(tx, tenantId, fyId, { actor: 'tester' }),
      /قيداً مسوّداً/,
    );

    await tx.journalLine.deleteMany({ where: { entryId: draft.id } });
    await tx.journalEntry.delete({ where: { id: draft.id } });
  });
});

test('الإقفال يصفّر المؤقّتة وينقل الصافي إلى الأرباح المبقاة', async () => {
  await withTenant(tenantId, async (tx) => {
    const before = await balanceSheet(tx, tenantId, day(12, 31), day(1, 1));
    assert.equal(before.currentYearProfit.toFixed(2), '80000.00', 'قبل الإقفال: بندٌ محسوب');
    assert.ok(before.balanced, 'ومتوازنة');

    const res = await closeFiscalYear(tx, tenantId, fyId, {
      closingDate: day(12, 31), actor: 'tester', note: 'إقفال سنوي',
    });
    assert.equal(res.netProfit.toFixed(2), '80000.00');
    assert.equal(res.closing.accountsClosed, 3);

    // المؤقّتة صُفِّرت
    const rev = await accountByRole(tx, tenantId, 'SERVICE_REVENUE');
    const revLedger = await generalLedger(tx, tenantId, rev.id, day(1, 1), day(12, 31));
    assert.equal(revLedger.closing.toFixed(2), '0.00', 'الإيراد صار صفراً');

    const pay = await accountByRole(tx, tenantId, 'PAYROLL_BASIC');
    const payLedger = await generalLedger(tx, tenantId, pay.id, day(1, 1), day(12, 31));
    assert.equal(payLedger.closing.toFixed(2), '0.00', 'والمصروف كذلك');

    // والصافي في الأرباح المبقاة
    const retained = await accountByRole(tx, tenantId, 'RETAINED_EARNINGS');
    const retLedger = await generalLedger(tx, tenantId, retained.id, day(1, 1), day(12, 31));
    assert.equal(retLedger.closing.toFixed(2), '80000.00');
  });
});

test('الميزانية تبقى متوازنة بعد الإقفال — والبند المحسوب يختفي', async () => {
  await withTenant(tenantId, async (tx) => {
    const after = await balanceSheet(tx, tenantId, day(12, 31), day(1, 1));
    assert.ok(after.balanced, `المركز المالي لا يتوازن: فرق ${after.difference.toFixed(2)}`);
    assert.equal(after.currentYearProfit.toFixed(2), '0.00', 'لم يعد ثمّة ربحٌ غير مُقفَل');
    assert.equal(after.totalEquity.toFixed(2), '380000.00', '٣٠٠٬٠٠٠ رأس مال + ٨٠٬٠٠٠ مبقاة');
  });
});

test('قائمة الدخل بعد الإقفال تعطي صفراً — المؤقّتة صُفِّرت', async () => {
  await withTenant(tenantId, async (tx) => {
    const pnl = await profitAndLoss(tx, tenantId, day(1, 1), day(12, 31));
    assert.equal(pnl.netProfit.toFixed(2), '0.00');
  });
});

test('الفترات تُقفل نهائياً ولا تقبل ترحيلاً', async () => {
  await withTenant(tenantId, async (tx) => {
    const locked = await tx.fiscalPeriod.count({ where: { fiscalYearId: fyId, status: 'LOCKED' } });
    assert.equal(locked, 12);

    await assert.rejects(
      () => postEntry(tx, tenantId, {
        date: day(7, 1),
        lines: [
          { accountCode: '5210', debit: 500 },
          { accountSubtype: 'BANK', credit: 500 },
        ],
      }),
      /مقفلة/,
    );
  });
});

test('لا تُقفل السنة مرّتين', async () => {
  await withTenant(tenantId, async (tx) => {
    await assert.rejects(
      () => closeFiscalYear(tx, tenantId, fyId, { actor: 'tester' }),
      /مُقفَلة سلفاً/,
    );
  });
});

test('الرصيد الافتتاحي للسنة التالية: الميزانية وحدها، متوازنة', async () => {
  await withTenant(tenantId, async (tx) => {
    const nextId = await createFiscalYear(tx, tenantId, Y + 1, 1);
    const ob = await openingBalances(tx, tenantId, nextId);

    assert.ok(ob.balanced, `الافتتاحي غير متوازن: ${ob.difference.toFixed(2)}`);
    assert.equal(ob.totalDebit.toFixed(2), ob.totalCredit.toFixed(2));
    assert.deepEqual(ob.unclosedTemporary, [], 'لا حساب مؤقّت بقي له رصيد');

    const codes = ob.rows.map((r) => r.code);
    assert.ok(codes.includes('3120'), 'الأرباح المبقاة تُرحَّل');
    assert.ok(!codes.some((c) => c.startsWith('4')), 'ولا إيراد يُرحَّل');
    assert.ok(!codes.some((c) => c.startsWith('5')), 'ولا مصروف');
  });
});

test('الرجوع عن الإقفال يفتح السنة ويعيد الأرصدة', async () => {
  await withTenant(tenantId, async (tx) => {
    await reverseClosing(tx, tenantId, fyId, { date: day(12, 31), actor: 'tester', reason: 'فاتورة متأخّرة' });

    const rev = await accountByRole(tx, tenantId, 'SERVICE_REVENUE');
    const revLedger = await generalLedger(tx, tenantId, rev.id, day(1, 1), day(12, 31));
    assert.equal(revLedger.closing.toFixed(2), '200000.00', 'عاد الإيراد');

    const retained = await accountByRole(tx, tenantId, 'RETAINED_EARNINGS');
    const retLedger = await generalLedger(tx, tenantId, retained.id, day(1, 1), day(12, 31));
    assert.equal(retLedger.closing.toFixed(2), '0.00', 'وخرجت الأرباح المبقاة');

    const open = await tx.fiscalPeriod.count({ where: { fiscalYearId: fyId, status: 'OPEN' } });
    assert.equal(open, 12, 'والفترات فُتحت');

    const closing = await tx.yearEndClosing.findFirstOrThrow({ where: { fiscalYearId: fyId } });
    assert.equal(closing.status, 'REVERSED', 'والسجلّ يبقى شاهداً أن السنة أُقفلت ثم فُتحت');
  });
});

test('الميزانية تتوازن بعد الرجوع كذلك', async () => {
  await withTenant(tenantId, async (tx) => {
    const bs = await balanceSheet(tx, tenantId, day(12, 31), day(1, 1));
    assert.ok(bs.balanced);
    assert.equal(bs.currentYearProfit.toFixed(2), '80000.00', 'عاد البند المحسوب');
    assert.equal(bs.totalEquity.toFixed(2), '380000.00', 'وإجمالي الحقوق لم يتغيّر');
  });
});

test('الميزان يتزن والدفتر سليم', async () => {
  await withTenant(tenantId, async (tx) => {
    const tb = await trialBalance(tx, tenantId, day(1, 1), day(12, 31));
    assert.equal(tb.totals.closingDebit.toFixed(2), tb.totals.closingCredit.toFixed(2));
    assert.deepEqual(await auditLedgerIntegrity(tx, tenantId), []);
  });
});
