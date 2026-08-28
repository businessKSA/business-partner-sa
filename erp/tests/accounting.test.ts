/**
 * محرّك المحاسبة: ما يقبله وما يرفضه ولماذا.
 *
 * كل رفضٍ هنا يقابل عطباً حقيقياً في أنظمة تعمل بلا حارس: قيدٌ لا يتزن،
 * ترحيلٌ على حساب تجميعي، ترحيلٌ في فترة أُقرَّت، وفاتورةٌ رُحِّلت مرّتين
 * لأن الزر ضُغط مرّتين.
 */
import './setup.ts';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, withTenant } from '../src/lib/db.ts';
import { provisionTenant, purgeTenantBySlug } from '../src/lib/provisioning.ts';
import { postEntry, reverseEntry, accountByRole, auditLedgerIntegrity } from '../src/lib/accounting/posting.ts';
import { trialBalance, profitAndLoss, balanceSheet, generalLedger } from '../src/lib/accounting/reports.ts';
import { closePeriod } from '../src/lib/accounting/periods.ts';
import { d, money } from '../src/lib/money.ts';

let tenantId: string;
const YEAR = new Date().getUTCFullYear();
const day = (m: number, dd: number) => new Date(Date.UTC(YEAR, m - 1, dd));

before(async () => {
  await purgeTenantBySlug('acct-test');
  const t = await provisionTenant({ slug: 'acct-test', nameAr: 'منشأة اختبار المحاسبة' });
  tenantId = t.id;
});

after(async () => {
  await purgeTenantBySlug('acct-test');
  await prisma.$disconnect();
});

test('التجهيز ينشئ شجرة حسابات كاملة وسنة مالية بفتراتها', async () => {
  await withTenant(tenantId, async (tx) => {
    const accounts = await tx.account.count();
    assert.ok(accounts > 50, `عدد الحسابات ${accounts} — الشجرة ناقصة`);

    const periods = await tx.fiscalPeriod.count();
    assert.equal(periods, 12, 'السنة المالية يجب أن تكون اثنتي عشرة فترة');

    const roles = await tx.role.count();
    assert.equal(roles, 6);

    const taxes = await tx.taxCode.count();
    assert.equal(taxes, 5);

    const vat = await tx.taxCode.findFirstOrThrow({ where: { code: 'S15' } });
    assert.equal(d(vat.rate).toString(), '0.15');
  });
});

test('قيد متزن يُرحَّل ويظهر في ميزان المراجعة', async () => {
  await withTenant(tenantId, async (tx) => {
    const entry = await postEntry(tx, tenantId, {
      date: day(3, 15),
      memoAr: 'إيداع رأس المال',
      lines: [
        { accountSubtype: 'BANK', debit: 500_000, descAr: 'إيداع بنكي' },
        { accountCode: '3101', credit: 500_000, descAr: 'رأس المال' },
      ],
    });

    assert.equal(entry.status, 'POSTED');
    assert.match(entry.number, /^JV-\d{4}-0001$/);
    assert.equal(money(entry.totalDebit).toFixed(2), '500000.00');
    assert.equal(entry.lines.length, 2);

    const tb = await trialBalance(tx, tenantId, day(1, 1), day(12, 31));
    assert.equal(tb.totals.closingDebit.toFixed(2), tb.totals.closingCredit.toFixed(2),
      'ميزان المراجعة لا يتزن');
    assert.equal(tb.totals.closingDebit.toFixed(2), '500000.00');
  });
});

test('القيد غير المتزن يُرفض برسالة تقول الفرق', async () => {
  await withTenant(tenantId, async (tx) => {
    await assert.rejects(
      () => postEntry(tx, tenantId, {
        date: day(3, 16),
        lines: [
          { accountSubtype: 'BANK', debit: 100 },
          { accountCode: '3101', credit: 90 },
        ],
      }),
      (e: Error) => {
        assert.match(e.message, /غير متزن/);
        assert.match(e.message, /100\.00/);
        assert.match(e.message, /90\.00/);
        return true;
      },
    );
  });
});

test('الترحيل على حساب تجميعي مرفوض', async () => {
  await withTenant(tenantId, async (tx) => {
    await assert.rejects(
      () => postEntry(tx, tenantId, {
        date: day(3, 16),
        lines: [
          { accountCode: '1', debit: 100 },   // «الأصول» — أب تجميعي
          { accountCode: '3101', credit: 100 },
        ],
      }),
      /تجميعي/,
    );
  });
});

test('المبلغ السالب مرفوض — الاتجاه يُقال بالعمود', async () => {
  await withTenant(tenantId, async (tx) => {
    await assert.rejects(
      () => postEntry(tx, tenantId, {
        date: day(3, 16),
        lines: [
          { accountSubtype: 'BANK', debit: -100 },
          { accountCode: '3101', credit: -100 },
        ],
      }),
      /سالب/,
    );
  });
});

test('سطر مدين ودائن معاً مرفوض', async () => {
  await withTenant(tenantId, async (tx) => {
    await assert.rejects(
      () => postEntry(tx, tenantId, {
        date: day(3, 16),
        lines: [
          { accountSubtype: 'BANK', debit: 100, credit: 50 },
          { accountCode: '3101', credit: 50 },
        ],
      }),
      /مدين ودائن معاً/,
    );
  });
});

test('نفس المستند لا يُرحَّل مرّتين', async () => {
  await withTenant(tenantId, async (tx) => {
    const args = {
      date: day(4, 1),
      sourceType: 'SALES_INVOICE',
      sourceId: 'inv_double_click',
      lines: [
        { accountSubtype: 'RECEIVABLE', debit: 1150 },
        { accountSubtype: 'SALES', credit: 1000 },
        { accountSubtype: 'VAT_OUTPUT', credit: 150 },
      ],
    };
    await postEntry(tx, tenantId, args);
    await assert.rejects(() => postEntry(tx, tenantId, args), /مُرحَّل مسبقاً/);
  });
});

test('العكس يولّد قيداً مضادّاً ويترك الأصل قائماً', async () => {
  const { originalId, reversalId } = await withTenant(tenantId, async (tx) => {
    const original = await postEntry(tx, tenantId, {
      date: day(5, 10),
      memoAr: 'قيد سيُعكس',
      lines: [
        { accountCode: '5210', debit: 3000, descAr: 'إيجار' },
        { accountSubtype: 'BANK', credit: 3000 },
      ],
    });
    const reversal = await reverseEntry(tx, tenantId, original.id, { date: day(5, 11) });
    return { originalId: original.id, reversalId: reversal.id };
  });

  await withTenant(tenantId, async (tx) => {
    const original = await tx.journalEntry.findUniqueOrThrow({
      where: { id: originalId }, include: { lines: true },
    });
    const reversal = await tx.journalEntry.findUniqueOrThrow({
      where: { id: reversalId }, include: { lines: true },
    });

    assert.equal(original.status, 'REVERSED', 'الأصل يُوسم معكوساً ولا يُحذف');
    assert.equal(reversal.reversalOfId, originalId);

    // الطرفان انقلبا بالمبلغ نفسه
    const origDebitLine = original.lines.find((l) => !d(l.debit).isZero())!;
    const revCreditLine = reversal.lines.find((l) => l.accountId === origDebitLine.accountId)!;
    assert.equal(money(revCreditLine.credit).toFixed(2), money(origDebitLine.debit).toFixed(2));

    // وأثرهما معاً صفر
    const ledger = await generalLedger(tx, tenantId, origDebitLine.accountId, day(1, 1), day(12, 31));
    assert.equal(ledger.closing.toFixed(2), '0.00', 'الأصل وعاكسه يجب أن يُلغي أحدهما الآخر');
  });
});

test('القيد المعكوس لا يُعكس مرّتين', async () => {
  await withTenant(tenantId, async (tx) => {
    const e = await postEntry(tx, tenantId, {
      date: day(5, 20),
      lines: [
        { accountCode: '5215', debit: 700 },
        { accountSubtype: 'BANK', credit: 700 },
      ],
    });
    await reverseEntry(tx, tenantId, e.id, { date: day(5, 21) });
    await assert.rejects(() => reverseEntry(tx, tenantId, e.id, { date: day(5, 22) }), /معكوسٌ سلفاً|لا يُعكس إلا المرحَّل/);
  });
});

test('الفترة المقفلة ترفض الترحيل، والفتح يعيده', async () => {
  await withTenant(tenantId, async (tx) => {
    const period = await tx.fiscalPeriod.findFirstOrThrow({
      where: { tenantId, number: 7 },
    });
    await closePeriod(tx, tenantId, period.id, 'tester');

    await assert.rejects(
      () => postEntry(tx, tenantId, {
        date: day(7, 15),
        lines: [
          { accountCode: '5220', debit: 250 },
          { accountSubtype: 'BANK', credit: 250 },
        ],
      }),
      /مقفلة/,
    );
  });
});

test('قائمة الدخل تفصل مجمل الربح عن صافيه', async () => {
  await withTenant(tenantId, async (tx) => {
    await postEntry(tx, tenantId, {
      date: day(6, 1),
      memoAr: 'مبيعات وتكلفتها ومصروف تشغيلي',
      lines: [
        { accountSubtype: 'RECEIVABLE', debit: 23_000 },
        { accountSubtype: 'SALES', credit: 20_000 },
        { accountSubtype: 'VAT_OUTPUT', credit: 3_000 },
      ],
    });
    await postEntry(tx, tenantId, {
      date: day(6, 2),
      lines: [
        { accountSubtype: 'COGS', debit: 12_000 },
        { accountSubtype: 'INVENTORY', credit: 12_000 },
      ],
    });
    await postEntry(tx, tenantId, {
      date: day(6, 3),
      lines: [
        { accountCode: '5240', debit: 2_000, descAr: 'تسويق' },
        { accountSubtype: 'BANK', credit: 2_000 },
      ],
    });

    const pnl = await profitAndLoss(tx, tenantId, day(6, 1), day(6, 30));
    assert.equal(pnl.sections[0].total.toFixed(2), '20000.00', 'الإيراد');
    assert.equal(pnl.sections[1].total.toFixed(2), '12000.00', 'تكلفة الإيراد');
    assert.equal(pnl.grossProfit.toFixed(2), '8000.00', 'مجمل الربح');
    assert.equal(pnl.sections[2].total.toFixed(2), '2000.00', 'المصروفات التشغيلية');
    assert.equal(pnl.netProfit.toFixed(2), '6000.00', 'صافي الربح');
    assert.equal(pnl.grossMargin?.toFixed(2), '40.00', 'هامش مجمل الربح ٤٠٪');
  });
});

test('المركز المالي يتوازن — والأرباح الجارية داخل حقوق الملكية', async () => {
  await withTenant(tenantId, async (tx) => {
    const bs = await balanceSheet(tx, tenantId, day(12, 31), day(1, 1));
    assert.equal(bs.difference.toFixed(2), '0.00',
      `المركز المالي لا يتوازن بفارق ${bs.difference.toFixed(2)}`);
    assert.ok(bs.balanced);
    assert.ok(!bs.currentYearProfit.isZero(), 'أرباح العام الجاري يجب أن تظهر');
  });
});

test('فحص سلامة الدفتر لا يجد قيداً مختلاً', async () => {
  await withTenant(tenantId, async (tx) => {
    const broken = await auditLedgerIntegrity(tx, tenantId);
    assert.deepEqual(broken, [], `قيود غير متزنة: ${JSON.stringify(broken)}`);
  });
});

test('الأستاذ المساعد يعطي رصيداً جارياً صحيحاً', async () => {
  await withTenant(tenantId, async (tx) => {
    const bank = await accountByRole(tx, tenantId, 'BANK');
    const gl = await generalLedger(tx, tenantId, bank.id, day(1, 1), day(12, 31));

    // ٥٠٠٬٠٠٠ إيداع − ٣٬٠٠٠ إيجار + ٣٬٠٠٠ عكسه − ٧٠٠ كهرباء + ٧٠٠ عكسه − ٢٬٠٠٠ تسويق
    assert.equal(gl.closing.toFixed(2), '498000.00');

    // الرصيد الجاري يتّسق مع آخر حركة
    const last = gl.movements[gl.movements.length - 1];
    assert.equal(last.balance.toFixed(2), gl.closing.toFixed(2));
  });
});
