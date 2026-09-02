/**
 * دورة المستندات: فاتورة مبيعات، فاتورة مورّد، سند سداد، إشعار دائن.
 *
 * ما يُختبر هنا ليس أن الشاشات تعمل، بل أن كل مستند يترك في الدفتر أثراً
 * صحيحاً: أن الذمم تزيد بالإجمالي، والإيراد بالوعاء، والضريبة على حسابها،
 * وأن السداد يُنقص الذمم لا الإيراد، وأن الإقرار الضريبي يُبنى من هذا كله
 * فيعطي الرقم الذي يُقدَّم للهيئة.
 */
import './setup.ts';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, withTenant } from '../src/lib/db.ts';
import { provisionTenant, purgeTenantBySlug } from '../src/lib/provisioning.ts';
import { createInvoice, postInvoice, cancelInvoice, computeLine } from '../src/lib/sales/invoices.ts';
import { createBill, postBill } from '../src/lib/purchasing/bills.ts';
import { createPayment, postPayment, cancelPayment } from '../src/lib/treasury/payments.ts';
import { trialBalance, partnerAging, generalLedger } from '../src/lib/accounting/reports.ts';
import { vatReturn } from '../src/lib/accounting/vat.ts';
import { accountByRole, auditLedgerIntegrity } from '../src/lib/accounting/posting.ts';
import { money, d } from '../src/lib/money.ts';

let tenantId: string;
let customerId: string;
let vendorId: string;
let bankAccountId: string;
/** الفاتورة الرئيسية التي تتابعها الاختبارات — تُمسك بمعرّفها لا برقمها،
 *  لأن أي اختبار يُنشئ فاتورةً قبلها يزيح ترقيمها. */
let mainInvoiceId: string;

const Y = new Date().getUTCFullYear();
const day = (m: number, dd: number) => new Date(Date.UTC(Y, m - 1, dd));

before(async () => {
  await purgeTenantBySlug('sales-test');
  const t = await provisionTenant({
    slug: 'sales-test', nameAr: 'منشأة اختبار الدورة',
    vatNumber: '310887376200003', city: 'الرياض',
  });
  tenantId = t.id;

  await withTenant(tenantId, async (tx) => {
    const c = await tx.partner.create({
      data: {
        tenantId, code: 'C-001', nameAr: 'مؤسسة العميل التجارية',
        isCustomer: true, vatNumber: '311111111101113',
        city: 'الرياض', paymentTermDays: 30,
      },
    });
    customerId = c.id;

    const v = await tx.partner.create({
      data: {
        tenantId, code: 'V-001', nameAr: 'شركة المورّد للتقنية',
        isCustomer: false, isVendor: true, vatNumber: '312222222202224',
      },
    });
    vendorId = v.id;

    const bankAcc = await accountByRole(tx, tenantId, 'BANK');
    const b = await tx.bankAccount.create({
      data: { tenantId, nameAr: 'الراجحي — الحساب الجاري', accountId: bankAcc.id, kind: 'BANK' },
    });
    bankAccountId = b.id;
  });
});

after(async () => {
  await purgeTenantBySlug('sales-test');
  await prisma.$disconnect();
});

test('حساب السطر: الخصم قبل الضريبة، والضريبة تُقرَّب على السطر', () => {
  const l = computeLine(3, 100, 50, 0.15);
  assert.equal(l.lineNet.toFixed(2), '250.00', 'الصافي = ٣×١٠٠ − ٥٠');
  assert.equal(l.lineVat.toFixed(2), '37.50');
  assert.equal(l.lineTotal.toFixed(2), '287.50');
});

test('خصم أكبر من قيمة السطر مرفوض', () => {
  assert.throws(() => computeLine(1, 100, 150, 0.15), /أكبر من قيمته/);
});

test('الفاتورة الضريبية تشترط معرّف المشتري', async () => {
  await withTenant(tenantId, async (tx) => {
    const anon = await tx.partner.create({
      data: { tenantId, code: 'C-ANON', nameAr: 'عميل بلا معرّف', isCustomer: true },
    });

    await assert.rejects(
      () => createInvoice(tx, tenantId, {
        partnerId: anon.id, issueDate: day(3, 1),
        lines: [{ descAr: 'خدمة', qty: 1, unitPrice: 100 }],
      }),
      /تشترط الرقم الضريبي|معرّفاً بديلاً/,
    );

    // والمبسطة لا تشترطه
    const simplified = await createInvoice(tx, tenantId, {
      partnerId: anon.id, issueDate: day(3, 1), kind: 'SIMPLIFIED',
      lines: [{ descAr: 'خدمة', qty: 1, unitPrice: 100 }],
    });
    assert.equal(simplified.kind, 'SIMPLIFIED');
  });
});

test('فاتورة مبيعات: تُنشأ مسوّدة ثم تُرحَّل فتُحدث الأثر الصحيح', async () => {
  const invoiceId = await withTenant(tenantId, async (tx) => {
    const inv = await createInvoice(tx, tenantId, {
      partnerId: customerId,
      issueDate: day(4, 1),
      lines: [
        { descAr: 'إدارة منصة قوى — اشتراك سنوي', qty: 12, unitPrice: 999 },
        { descAr: 'إضافة مدد', qty: 12, unitPrice: 199 },
      ],
    });

    assert.equal(inv.status, 'DRAFT');
    assert.match(inv.number, /^INV-\d{4}-\d{4}$/);
    assert.equal(money(inv.taxableAmount).toFixed(2), '14376.00', '١٢×٩٩٩ + ١٢×١٩٩');
    assert.equal(money(inv.vatTotal).toFixed(2), '2156.40');
    assert.equal(money(inv.total).toFixed(2), '16532.40');

    // مهلة السداد ٣٠ يوماً تُطبَّق تلقائياً من ملف العميل
    assert.equal(inv.dueDate?.toISOString().slice(0, 10), day(5, 1).toISOString().slice(0, 10));

    const posted = await postInvoice(tx, tenantId, inv.id, 'tester');
    assert.equal(posted.status, 'POSTED');
    assert.ok(posted.journalEntryId);

    return inv.id;
  });
  mainInvoiceId = invoiceId;

  await withTenant(tenantId, async (tx) => {
    const ar = await accountByRole(tx, tenantId, 'RECEIVABLE');
    const sales = await accountByRole(tx, tenantId, 'SALES');
    const vat = await accountByRole(tx, tenantId, 'VAT_OUTPUT');

    const arLedger = await generalLedger(tx, tenantId, ar.id, day(1, 1), day(12, 31));
    assert.equal(arLedger.closing.toFixed(2), '16532.40', 'الذمم تزيد بالإجمالي');

    const salesLedger = await generalLedger(tx, tenantId, sales.id, day(1, 1), day(12, 31));
    assert.equal(salesLedger.closing.toFixed(2), '14376.00', 'الإيراد بالوعاء لا بالإجمالي');

    const vatLedger = await generalLedger(tx, tenantId, vat.id, day(1, 1), day(12, 31));
    assert.equal(vatLedger.closing.toFixed(2), '2156.40', 'الضريبة على حسابها المستقل');
  });
});

test('لا تُرحَّل الفاتورة مرّتين', async () => {
  await withTenant(tenantId, async (tx) => {
    await assert.rejects(() => postInvoice(tx, tenantId, mainInvoiceId), /لا يُرحَّل إلا المسوّد/);
  });
});

test('فاتورة مورّد: ضريبة المدخلات أصلٌ مدين لا خصم', async () => {
  await withTenant(tenantId, async (tx) => {
    const bill = await createBill(tx, tenantId, {
      partnerId: vendorId,
      vendorRef: 'SUP-2026-77',
      issueDate: day(4, 5),
      lines: [{ descAr: 'اشتراك برمجيات سنوي', qty: 1, unitPrice: 4000 }],
    });

    assert.equal(money(bill.total).toFixed(2), '4600.00');
    await postBill(tx, tenantId, bill.id, 'tester');

    const vatIn = await accountByRole(tx, tenantId, 'VAT_INPUT');
    const ledger = await generalLedger(tx, tenantId, vatIn.id, day(1, 1), day(12, 31));
    assert.equal(ledger.closing.toFixed(2), '600.00');
    assert.equal(ledger.totalDebit.toFixed(2), '600.00', 'المدخلات مدينة');
  });
});

test('فاتورة المورّد نفسها لا تُدخل مرّتين', async () => {
  await withTenant(tenantId, async (tx) => {
    await assert.rejects(
      () => createBill(tx, tenantId, {
        partnerId: vendorId, vendorRef: 'SUP-2026-77', issueDate: day(4, 6),
        lines: [{ descAr: 'نفس الفاتورة', qty: 1, unitPrice: 4000 }],
      }),
      /مُدخَلة سلفاً/,
    );
  });
});

test('سند قبض جزئي: يُنقص الذمم ويضع الفاتورة «مسدَّدة جزئياً»', async () => {
  await withTenant(tenantId, async (tx) => {
    const inv = await tx.salesInvoice.findUniqueOrThrow({ where: { id: mainInvoiceId } });

    const pay = await createPayment(tx, tenantId, {
      direction: 'IN', partnerId: customerId, paymentDate: day(4, 20),
      amount: 10_000, bankAccountId, method: 'TRANSFER', ref: 'TRF-991',
      allocations: [{ salesInvoiceId: inv.id, amount: 10_000 }],
    });

    await postPayment(tx, tenantId, pay.id, 'tester');

    const after = await tx.salesInvoice.findUniqueOrThrow({ where: { id: inv.id } });
    assert.equal(after.status, 'PARTIALLY_PAID');
    assert.equal(money(after.paidAmount).toFixed(2), '10000.00');

    const ar = await accountByRole(tx, tenantId, 'RECEIVABLE');
    const ledger = await generalLedger(tx, tenantId, ar.id, day(1, 1), day(12, 31));
    assert.equal(ledger.closing.toFixed(2), '6532.40', 'المتبقّي على العميل');
  });
});

test('لا يُخصَّص على فاتورة أكثر من متبقّيها', async () => {
  await withTenant(tenantId, async (tx) => {
    const inv = await tx.salesInvoice.findUniqueOrThrow({ where: { id: mainInvoiceId } });
    await assert.rejects(
      () => createPayment(tx, tenantId, {
        direction: 'IN', partnerId: customerId, paymentDate: day(4, 25),
        amount: 99_999, bankAccountId,
        allocations: [{ salesInvoiceId: inv.id, amount: 99_999 }],
      }),
      /أكبر من المتبقّي/,
    );
  });
});

test('الدفعة غير المخصَّصة التزامٌ لا إيراد', async () => {
  await withTenant(tenantId, async (tx) => {
    const pay = await createPayment(tx, tenantId, {
      direction: 'IN', partnerId: customerId, paymentDate: day(5, 2),
      amount: 5_000, bankAccountId, notesAr: 'دفعة مقدمة لخدمة قادمة',
    });
    await postPayment(tx, tenantId, pay.id, 'tester');

    const advance = await accountByRole(tx, tenantId, 'CUSTOMER_ADVANCE');
    const ledger = await generalLedger(tx, tenantId, advance.id, day(1, 1), day(12, 31));
    assert.equal(ledger.closing.toFixed(2), '5000.00', 'الدفعة المقدمة التزام دائن');

    const sales = await accountByRole(tx, tenantId, 'SALES');
    const salesLedger = await generalLedger(tx, tenantId, sales.id, day(1, 1), day(12, 31));
    assert.equal(salesLedger.closing.toFixed(2), '14376.00', 'الإيراد لم يتأثّر بالدفعة المقدمة');
  });
});

test('إلغاء السند يردّ المسدَّد على الفاتورة', async () => {
  await withTenant(tenantId, async (tx) => {
    const pay = await tx.payment.findFirstOrThrow({
      where: { tenantId, status: 'POSTED', ref: 'TRF-991' },
    });
    await cancelPayment(tx, tenantId, pay.id, { date: day(5, 3), reason: 'حوالة مرتدّة' });

    const inv = await tx.salesInvoice.findUniqueOrThrow({ where: { id: mainInvoiceId } });
    assert.equal(money(inv.paidAmount).toFixed(2), '0.00');
    assert.equal(inv.status, 'POSTED', 'تعود «مرحَّلة» لا «مسدَّدة جزئياً»');
  });
});

test('إشعار دائن يشترط الأصل والسبب، ويقلب القيد', async () => {
  await withTenant(tenantId, async (tx) => {
    const original = await tx.salesInvoice.findUniqueOrThrow({ where: { id: mainInvoiceId } });

    await assert.rejects(
      () => createInvoice(tx, tenantId, {
        partnerId: customerId, issueDate: day(6, 1), docType: 'CREDIT_NOTE',
        lines: [{ descAr: 'ردّ', qty: 1, unitPrice: 999 }],
      }),
      /يشترط الفاتورة الأصلية/,
    );

    const cn = await createInvoice(tx, tenantId, {
      partnerId: customerId, issueDate: day(6, 1), docType: 'CREDIT_NOTE',
      originalInvoiceId: original.id,
      correctionReason: 'إلغاء شهرين لم تُقدَّم فيهما الخدمة',
      lines: [{ descAr: 'ردّ اشتراك شهرين', qty: 2, unitPrice: 999 }],
    });

    assert.match(cn.number, /^CN-\d{4}-0001$/, 'الإشعار له تسلسله المستقل');
    await postInvoice(tx, tenantId, cn.id, 'tester');

    const ar = await accountByRole(tx, tenantId, 'RECEIVABLE');
    const ledger = await generalLedger(tx, tenantId, ar.id, day(1, 1), day(12, 31));
    // ١٦٥٣٢٫٤٠ الفاتورة، ثم −١٠٠٠٠ السند، ثم +١٠٠٠٠ لإلغائه، ثم −٢٢٩٧٫٧٠
    // للإشعار الدائن. والدفعة المقدمة (٥٠٠٠) لا تمسّ الذمم أصلاً — لها
    // حسابها، وهو ما أثبته الاختبار قبله.
    assert.equal(ledger.closing.toFixed(2), '14234.70');
  });
});

test('إقرار ضريبة القيمة المضافة يُبنى من الدفتر لا من الفواتير', async () => {
  await withTenant(tenantId, async (tx) => {
    const vat = await vatReturn(tx, tenantId, day(1, 1), day(12, 31));

    // مخرجات: ٢١٥٦٫٤٠ من الفاتورة − ٢٩٩٫٧٠ من الإشعار الدائن
    assert.equal(vat.outputVat.toFixed(2), '1856.70');
    // مدخلات: ٦٠٠ من فاتورة المورّد
    assert.equal(vat.inputVat.toFixed(2), '600.00');
    assert.equal(vat.netVat.toFixed(2), '1256.70', 'المستحقّ للهيئة');
    assert.equal(vat.payable.toFixed(2), '1256.70');
    assert.equal(vat.refundable.toFixed(2), '0.00');

    // والوعاء يتّسق مع الضريبة
    const standardSales = vat.salesBoxes.find((b) => b.key === 'standardSales')!;
    assert.equal(standardSales.amount.toFixed(2), '12378.00', '١٤٣٧٦ − ١٩٩٨');
  });
});

test('أعمار الذمم تعرض رصيد العميل على شرائحه', async () => {
  await withTenant(tenantId, async (tx) => {
    const aging = await partnerAging(tx, tenantId, 'RECEIVABLE', day(12, 31));
    const customer = aging.find((a) => a.code === 'C-001');
    assert.ok(customer, 'العميل غائب عن أعمار الذمم');
    // الذمم بعد الفاتورة والإشعار الدائن والسندَين الصغيرين في آخر الاختبارات
    assert.ok(customer.total.greaterThan(0), 'رصيد العميل يجب أن يكون مديناً');
  });
});

test('الفاتورة المسدَّد عليها لا تُلغى', async () => {
  await withTenant(tenantId, async (tx) => {
    const pay = await createPayment(tx, tenantId, {
      direction: 'IN', partnerId: customerId, paymentDate: day(7, 1),
      amount: 1_000, bankAccountId,
      allocations: [],
    });
    await postPayment(tx, tenantId, pay.id);

    const inv = await tx.salesInvoice.findUniqueOrThrow({ where: { id: mainInvoiceId } });
    // نسدّد عليها ثم نحاول الإلغاء
    const p2 = await createPayment(tx, tenantId, {
      direction: 'IN', partnerId: customerId, paymentDate: day(7, 2),
      amount: 500, bankAccountId,
      allocations: [{ salesInvoiceId: inv.id, amount: 500 }],
    });
    await postPayment(tx, tenantId, p2.id);

    await assert.rejects(
      () => cancelInvoice(tx, tenantId, inv.id, { date: day(7, 3) }),
      /سُدِّد منها/,
    );
  });
});

test('الميزان يتزن والدفتر سليم بعد كل هذه الحركات', async () => {
  await withTenant(tenantId, async (tx) => {
    const tb = await trialBalance(tx, tenantId, day(1, 1), day(12, 31));
    assert.equal(
      tb.totals.closingDebit.toFixed(2),
      tb.totals.closingCredit.toFixed(2),
      'ميزان المراجعة لا يتزن',
    );

    const broken = await auditLedgerIntegrity(tx, tenantId);
    assert.deepEqual(broken, [], `قيود غير متزنة: ${JSON.stringify(broken)}`);
  });
});
