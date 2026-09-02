/**
 * تعدّد العملات وفروق الصرف.
 *
 * أهمّ ما يُختبر هنا ليس الحساب — هو ضربٌ وطرح — بل **العكس التلقائي**
 * للفرق غير المحقَّق. نظامٌ يثبّته ولا يرفعه يُنتج بعد اثني عشر شهراً رصيداً
 * هو مجموع اثني عشر تقديراً، لا رصيداً يقابله شيء. الاختبار الأخير يشغّل
 * ثلاث عمليات تقييم متتالية ويتأكّد أن الأثر التراكمي صفر.
 */
import './setup.ts';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, withTenant } from '../src/lib/db.ts';
import { provisionTenant, purgeTenantBySlug } from '../src/lib/provisioning.ts';
import {
  setRate, rateOn, toBase, realizedDifference, postRealizedDifference,
  previewRevaluation, postRevaluation, currencyExposure,
} from '../src/lib/accounting/fx.ts';
import { postEntry, accountByRole, auditLedgerIntegrity } from '../src/lib/accounting/posting.ts';
import { generalLedger, trialBalance } from '../src/lib/accounting/reports.ts';
import { money, d } from '../src/lib/money.ts';

let tenantId: string;
let eurBankId: string;
const Y = new Date().getUTCFullYear();
const day = (m: number, dd: number) => new Date(Date.UTC(Y, m - 1, dd));

before(async () => {
  await purgeTenantBySlug('fx-test');
  const t = await provisionTenant({ slug: 'fx-test', nameAr: 'منشأة اختبار العملات' });
  tenantId = t.id;

  await withTenant(tenantId, async (tx) => {
    // حساب بنك باليورو تحت النقد لدى البنوك
    const parent = await accountByRole(tx, tenantId, 'BANK');
    const eur = await tx.account.create({
      data: {
        tenantId, code: '1103', nameAr: 'حساب بنكي باليورو', nameEn: 'EUR Bank',
        type: 'ASSET', subtype: 'BANK', parentId: parent.parentId, currency: 'EUR',
      },
    });
    eurBankId = eur.id;

    // أسعار الصرف عبر السنة
    await setRate(tx, tenantId, 'EUR', day(1, 1), '4.10');
    await setRate(tx, tenantId, 'EUR', day(6, 1), '4.20');
    await setRate(tx, tenantId, 'EUR', day(9, 1), '4.05');
  });
});

after(async () => {
  await purgeTenantBySlug('fx-test');
  await prisma.$disconnect();
});

// ── أسعار الصرف ──────────────────────────────────────────────────────────

test('يُقرأ آخر سعر في التاريخ أو قبله — لا بعده', async () => {
  await withTenant(tenantId, async (tx) => {
    assert.equal((await rateOn(tx, tenantId, 'EUR', day(3, 15))).toFixed(2), '4.10');
    assert.equal((await rateOn(tx, tenantId, 'EUR', day(6, 1))).toFixed(2), '4.20');
    assert.equal((await rateOn(tx, tenantId, 'EUR', day(7, 20))).toFixed(2), '4.20');
    assert.equal((await rateOn(tx, tenantId, 'EUR', day(12, 1))).toFixed(2), '4.05');
  });
});

test('عملة الدفاتر سعرها واحد بلا بحث', async () => {
  await withTenant(tenantId, async (tx) => {
    assert.equal((await rateOn(tx, tenantId, 'SAR', day(3, 1))).toFixed(2), '1.00');
  });
});

test('غياب السعر يُرفض برسالة تقول ما ينقص', async () => {
  await withTenant(tenantId, async (tx) => {
    await assert.rejects(
      () => rateOn(tx, tenantId, 'JPY', day(3, 1)),
      /لا يوجد سعر صرف لعملة JPY/,
    );
    // وقبل أول سعر معلن كذلك
    await assert.rejects(
      () => rateOn(tx, tenantId, 'EUR', new Date(Date.UTC(Y - 1, 5, 1))),
      /لا يوجد سعر صرف/,
    );
  });
});

test('التحويل إلى عملة الدفاتر بسعر يومه', async () => {
  await withTenant(tenantId, async (tx) => {
    const r = await toBase(tx, tenantId, 1000, 'EUR', day(3, 1));
    assert.equal(r.base.toFixed(2), '4100.00');
    assert.equal(r.rate.toFixed(2), '4.10');
  });
});

// ── الفرق المحقَّق ───────────────────────────────────────────────────────

test('الذمّة المدينة: ارتفاع السعر ربح، وانخفاضه خسارة', () => {
  // ١٠٠٠ يورو قُيّدت بـ٤٫١٠ وسُدِّدت بـ٤٫٢٠ ⇒ قبضنا ١٠٠ ريال أكثر
  assert.equal(realizedDifference(1000, '4.10', '4.20', 'RECEIVABLE').toFixed(2), '100.00');
  // وبـ٤٫٠٠ ⇒ قبضنا ١٠٠ أقل
  assert.equal(realizedDifference(1000, '4.10', '4.00', 'RECEIVABLE').toFixed(2), '-100.00');
});

test('الذمّة الدائنة: الاتجاه معكوس — ارتفاع السعر خسارة', () => {
  // ١٠٠٠ يورو علينا قُيّدت بـ٤٫١٠ ودفعناها بـ٤٫٢٠ ⇒ دفعنا ١٠٠ أكثر
  assert.equal(realizedDifference(1000, '4.10', '4.20', 'PAYABLE').toFixed(2), '-100.00');
  assert.equal(realizedDifference(1000, '4.10', '4.00', 'PAYABLE').toFixed(2), '100.00');
});

test('لا فرق حين لا يتغيّر السعر', () => {
  assert.equal(realizedDifference(5000, '4.10', '4.10', 'RECEIVABLE').toFixed(2), '0.00');
});

test('الفرق المحقَّق يُقيَّد نهائياً — ربحاً أو خسارة', async () => {
  await withTenant(tenantId, async (tx) => {
    const ar = await accountByRole(tx, tenantId, 'RECEIVABLE');

    // خسارة محقَّقة ١٠٠
    await postRealizedDifference(tx, tenantId, {
      date: day(2, 15),
      difference: -100,
      counterAccountId: ar.id,
      descAr: 'فرق عملة عند تحصيل فاتورة باليورو',
      actor: 'tester',
    });

    const fx = await accountByRole(tx, tenantId, 'FX_DIFFERENCE');
    const ledger = await generalLedger(tx, tenantId, fx.id, day(1, 1), day(12, 31));
    assert.equal(ledger.closing.toFixed(2), '100.00', 'الخسارة مصروف مدين');
  });
});

test('فرقٌ صفر لا يُقيَّد أصلاً', async () => {
  await withTenant(tenantId, async (tx) => {
    const ar = await accountByRole(tx, tenantId, 'RECEIVABLE');
    const res = await postRealizedDifference(tx, tenantId, {
      date: day(2, 16), difference: 0, counterAccountId: ar.id, descAr: 'بلا فرق',
    });
    assert.equal(res, null);
  });
});

// ── إعادة التقييم ───────────────────────────────────────────────────────

test('إعادة التقييم تقيس الفرق بين الدفتري والسعر الحالي', async () => {
  await withTenant(tenantId, async (tx) => {
    // إيداع ١٠٬٠٠٠ يورو في يناير بسعر ٤٫١٠ ⇒ ٤١٬٠٠٠ ريال
    // العمود `currency` في السطر يحمل المبلغ بالعملة الأجنبية
    const cap = await tx.account.findFirstOrThrow({ where: { tenantId, code: '3101' } });
    await postEntry(tx, tenantId, {
      date: day(1, 10),
      memoAr: 'إيداع رأس مال باليورو',
      sourceType: 'OPENING',
      lines: [
        { accountId: eurBankId, debit: 41_000, foreignAmount: 10_000, fxRate: '4.10', descAr: 'إيداع' },
        { accountId: cap.id, credit: 41_000, descAr: 'رأس المال' },
      ] as never,
    });

    // في يونيو السعر ٤٫٢٠ ⇒ القيمة ٤٢٬٠٠٠، والفرق +١٬٠٠٠
    const p = await previewRevaluation(tx, tenantId, day(6, 30));
    assert.equal(p.lines.length, 1);

    const line = p.lines[0];
    assert.equal(line.currency, 'EUR');
    assert.equal(line.foreignBalance.toFixed(2), '10000.00');
    assert.equal(line.bookValue.toFixed(2), '41000.00');
    assert.equal(line.rate.toFixed(2), '4.20');
    assert.equal(line.revaluedValue.toFixed(2), '42000.00');
    assert.equal(line.difference.toFixed(2), '1000.00');
    assert.equal(p.netDifference.toFixed(2), '1000.00');
  });
});

test('الترحيل يثبّت الفرق ثم يرفعه في اليوم التالي', async () => {
  await withTenant(tenantId, async (tx) => {
    const rev = await postRevaluation(tx, tenantId, day(6, 30), { actor: 'tester' });

    assert.equal(rev.status, 'POSTED');
    assert.equal(money(rev.netDifference).toFixed(2), '1000.00');
    assert.ok(rev.journalEntryId, 'قيد التثبيت');
    assert.ok(rev.reversalEntryId, 'وقيد الرفع');

    // في يوم التقييم: الحساب مُقيَّم بـ٤٢٬٠٠٠
    const at = await generalLedger(tx, tenantId, eurBankId, day(1, 1), day(6, 30));
    assert.equal(at.closing.toFixed(2), '42000.00', 'يوم التقييم يظهر بالقيمة الحالية');

    // وبعده بيوم: عاد إلى قيمته الدفترية الأصلية
    const after = await generalLedger(tx, tenantId, eurBankId, day(1, 1), day(7, 1));
    assert.equal(after.closing.toFixed(2), '41000.00', 'ورُفع الفرق في اليوم التالي');
  });
});

test('الفرق غير المحقَّق لا يتراكم — ثلاث عمليات تقييم أثرها صفر', async () => {
  await withTenant(tenantId, async (tx) => {
    // تقييمان إضافيان بأسعار مختلفة
    await postRevaluation(tx, tenantId, day(9, 30), { actor: 'tester' });
    await setRate(tx, tenantId, 'EUR', day(11, 1), '4.35');
    await postRevaluation(tx, tenantId, day(11, 30), { actor: 'tester' });

    // بعد كل التقييمات: الرصيد الدفتري لم يتغيّر عن الأصل
    const end = await generalLedger(tx, tenantId, eurBankId, day(1, 1), day(12, 31));
    assert.equal(
      end.closing.toFixed(2), '41000.00',
      'ثلاث عمليات تقييم ولم يتراكم شيء — وهذا هو الغرض من العكس التلقائي',
    );

    const count = await tx.fxRevaluation.count({ where: { tenantId } });
    assert.equal(count, 3);
  });
});

test('تقرير الانكشاف يجمع بالعملة', async () => {
  await withTenant(tenantId, async (tx) => {
    const exp = await currencyExposure(tx, tenantId, day(12, 31));
    assert.equal(exp.baseCurrency, 'SAR');
    assert.equal(exp.currencies.length, 1);

    const eur = exp.currencies[0];
    assert.equal(eur.currency, 'EUR');
    assert.equal(eur.foreignBalance.toFixed(2), '10000.00');
    assert.equal(eur.bookValue.toFixed(2), '41000.00');
    // بسعر ديسمبر ٤٫٣٥ ⇒ ٤٣٬٥٠٠
    assert.equal(eur.currentValue.toFixed(2), '43500.00');
    assert.equal(eur.exposure.toFixed(2), '2500.00');
  });
});

test('لا أرصدة أجنبية ⇒ التقييم يُرفض بدل أن يولّد قيداً فارغاً', async () => {
  await withTenant(tenantId, async (tx) => {
    // تاريخٌ قبل أي حركة باليورو
    await assert.rejects(
      () => postRevaluation(tx, tenantId, day(1, 5)),
      /لا أرصدة بعملات أجنبية/,
    );
  });
});

test('الميزان يتزن والدفتر سليم بعد كل التقييمات', async () => {
  await withTenant(tenantId, async (tx) => {
    const tb = await trialBalance(tx, tenantId, day(1, 1), day(12, 31));
    assert.equal(tb.totals.closingDebit.toFixed(2), tb.totals.closingCredit.toFixed(2));
    assert.deepEqual(await auditLedgerIntegrity(tx, tenantId), []);
  });
});
