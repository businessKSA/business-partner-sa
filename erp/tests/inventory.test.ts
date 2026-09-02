/**
 * المخزون: المتوسط المرجّح، ومنع السالب، وتكلفة المبيعات، والمطابقة.
 *
 * السؤال الذي يجيب عنه هذا الملف: هل قيمة المخزون في الميزانية تساوي ما
 * في المستودع فعلاً؟ ولذلك ينتهي بمقارنة الرصيد الدفتري بمجموع الحركات،
 * وبقيمة حساب المخزون في الأستاذ.
 */
import './setup.ts';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, withTenant } from '../src/lib/db.ts';
import { provisionTenant, purgeTenantBySlug } from '../src/lib/provisioning.ts';
import {
  newAverageCost, recordMove, postGoodsReceipt, issueStockForInvoice,
  adjustStock, transferStock, stockValuation, reconcileStock,
} from '../src/lib/inventory/costing.ts';
import { createInvoice, postInvoice } from '../src/lib/sales/invoices.ts';
import { accountByRole, auditLedgerIntegrity } from '../src/lib/accounting/posting.ts';
import { generalLedger, trialBalance } from '../src/lib/accounting/reports.ts';
import { nextNumber } from '../src/lib/accounting/numbering.ts';
import { money, d } from '../src/lib/money.ts';

let tenantId: string;
let itemId: string;
let serviceId: string;
let mainWh: string;
let branchWh: string;
let customerId: string;
let vendorId: string;

const Y = new Date().getUTCFullYear();
const day = (m: number, dd: number) => new Date(Date.UTC(Y, m - 1, dd));

before(async () => {
  await purgeTenantBySlug('inv-test');
  const t = await provisionTenant({ slug: 'inv-test', nameAr: 'منشأة اختبار المخزون', vatNumber: '310887376200003' });
  tenantId = t.id;

  await withTenant(tenantId, async (tx) => {
    const inv = await accountByRole(tx, tenantId, 'INVENTORY');
    const sales = await accountByRole(tx, tenantId, 'SALES');
    const cogs = await accountByRole(tx, tenantId, 'COGS');

    const item = await tx.item.create({
      data: {
        tenantId, sku: 'LAP-001', nameAr: 'حاسب محمول', kind: 'STOCK',
        uomCode: 'PCE', salesPrice: '5000', purchasePrice: '3000',
        inventoryAccountId: inv.id, incomeAccountId: sales.id, expenseAccountId: cogs.id,
        reorderPoint: '5',
      },
    });
    itemId = item.id;

    const svc = await tx.item.create({
      data: {
        tenantId, sku: 'SVC-001', nameAr: 'خدمة تركيب', kind: 'SERVICE',
        uomCode: 'HUR', salesPrice: '200', incomeAccountId: sales.id,
      },
    });
    serviceId = svc.id;

    mainWh = (await tx.warehouse.findFirstOrThrow({ where: { tenantId, code: 'MAIN' } })).id;
    branchWh = (await tx.warehouse.create({
      data: { tenantId, code: 'BR-01', nameAr: 'مستودع الفرع' },
    })).id;

    customerId = (await tx.partner.create({
      data: { tenantId, code: 'C-1', nameAr: 'عميل', isCustomer: true, vatNumber: '311111111101113' },
    })).id;
    vendorId = (await tx.partner.create({
      data: { tenantId, code: 'V-1', nameAr: 'مورّد', isCustomer: false, isVendor: true },
    })).id;
  });
});

after(async () => {
  await purgeTenantBySlug('inv-test');
  await prisma.$disconnect();
});

test('صيغة المتوسط المرجّح — محسوبة يدوياً', () => {
  // ١٠ وحدات بتكلفة ١٠٠، ثم ١٠ بتكلفة ٢٠٠ ⇒ المتوسط ١٥٠
  assert.equal(newAverageCost(10, 100, 10, 200).toFixed(2), '150.00');

  // ٣٠ بتكلفة ١٠٠، ثم ١٠ بتكلفة ٢٠٠ ⇒ (٣٠٠٠+٢٠٠٠)/٤٠ = ١٢٥
  assert.equal(newAverageCost(30, 100, 10, 200).toFixed(2), '125.00');

  // رصيد صفر: المتوسط يصير تكلفة الوارد لا صفراً
  assert.equal(newAverageCost(0, 0, 5, 320).toFixed(2), '320.00');
});

test('الاستلام يرفع الرصيد ويحدّث المتوسط ويرحّل القيد', async () => {
  await withTenant(tenantId, async (tx) => {
    const number = await nextNumber(tx, tenantId, 'GOODS_RECEIPT', day(2, 1));
    const receipt = await tx.goodsReceipt.create({
      data: {
        tenantId, number, partnerId: vendorId, warehouseId: mainWh,
        receiptDate: day(2, 1),
        lines: { create: [{ tenantId, itemId, qty: '10', unitCost: '3000' }] },
      },
    });

    await postGoodsReceipt(tx, tenantId, receipt.id, 'tester');

    const item = await tx.item.findUniqueOrThrow({ where: { id: itemId } });
    assert.equal(d(item.onHand).toFixed(0), '10');
    assert.equal(money(item.avgCost).toFixed(2), '3000.00');

    const invAcc = await accountByRole(tx, tenantId, 'INVENTORY');
    const ledger = await generalLedger(tx, tenantId, invAcc.id, day(1, 1), day(12, 31));
    assert.equal(ledger.closing.toFixed(2), '30000.00');

    const grni = await accountByRole(tx, tenantId, 'GRNI');
    const grniLedger = await generalLedger(tx, tenantId, grni.id, day(1, 1), day(12, 31));
    assert.equal(grniLedger.closing.toFixed(2), '30000.00', 'التزامٌ قائم حتى تصل الفاتورة');
  });
});

test('استلام ثانٍ بسعر مختلف يعيد حساب المتوسط', async () => {
  await withTenant(tenantId, async (tx) => {
    const number = await nextNumber(tx, tenantId, 'GOODS_RECEIPT', day(3, 1));
    const receipt = await tx.goodsReceipt.create({
      data: {
        tenantId, number, partnerId: vendorId, warehouseId: mainWh,
        receiptDate: day(3, 1),
        lines: { create: [{ tenantId, itemId, qty: '10', unitCost: '3600' }] },
      },
    });
    await postGoodsReceipt(tx, tenantId, receipt.id, 'tester');

    const item = await tx.item.findUniqueOrThrow({ where: { id: itemId } });
    assert.equal(d(item.onHand).toFixed(0), '20');
    // (١٠×٣٠٠٠ + ١٠×٣٦٠٠) ÷ ٢٠ = ٣٣٠٠
    assert.equal(money(item.avgCost).toFixed(2), '3300.00');
  });
});

test('صرف أكثر من الرصيد مرفوض — والرسالة تقول المتاح', async () => {
  await withTenant(tenantId, async (tx) => {
    await assert.rejects(
      () => recordMove(tx, tenantId, {
        itemId, warehouseId: mainWh, moveDate: day(4, 1),
        qty: -50, reason: 'SALE',
      }),
      (e: Error) => {
        assert.match(e.message, /لا يكفي/);
        assert.match(e.message, /20/);
        return true;
      },
    );
  });
});

test('بيع صنف مخزني يولّد قيد تكلفة مستقلاً عن قيد الفاتورة', async () => {
  await withTenant(tenantId, async (tx) => {
    const inv = await createInvoice(tx, tenantId, {
      partnerId: customerId, issueDate: day(4, 10),
      lines: [
        { itemId, descAr: 'حاسب محمول', qty: 4, unitPrice: 5000 },
        { itemId: serviceId, descAr: 'خدمة تركيب', qty: 2, unitPrice: 200 },
      ],
    });
    await postInvoice(tx, tenantId, inv.id, 'tester');
    await issueStockForInvoice(tx, tenantId, inv.id, mainWh, 'tester');

    const item = await tx.item.findUniqueOrThrow({ where: { id: itemId } });
    assert.equal(d(item.onHand).toFixed(0), '16', 'الخدمة لا تُنقص المخزون');

    const cogs = await accountByRole(tx, tenantId, 'COGS');
    const cogsLedger = await generalLedger(tx, tenantId, cogs.id, day(1, 1), day(12, 31));
    assert.equal(cogsLedger.closing.toFixed(2), '13200.00', '٤ × ٣٣٠٠');

    const invAcc = await accountByRole(tx, tenantId, 'INVENTORY');
    const invLedger = await generalLedger(tx, tenantId, invAcc.id, day(1, 1), day(12, 31));
    assert.equal(invLedger.closing.toFixed(2), '52800.00', '٦٦٠٠٠ − ١٣٢٠٠');

    // قيدان لا قيد واحد: الإيراد وتكلفته منفصلان
    const entries = await tx.journalEntry.findMany({
      where: { tenantId, sourceId: inv.id },
      select: { sourceType: true },
    });
    const kinds = entries.map((e) => e.sourceType).sort();
    assert.deepEqual(kinds, ['SALES_INVOICE', 'STOCK_MOVE']);
  });
});

test('التحويل بين المستودعات لا يغيّر القيمة الإجمالية', async () => {
  await withTenant(tenantId, async (tx) => {
    const before = await stockValuation(tx, tenantId);
    await transferStock(tx, tenantId, {
      itemId, fromWarehouseId: mainWh, toWarehouseId: branchWh, qty: 6, date: day(5, 1),
    });
    const after = await stockValuation(tx, tenantId);

    assert.equal(after.totalValue.toFixed(2), before.totalValue.toFixed(2));

    const branch = after.rows.find((r) => r.warehouseAr === 'مستودع الفرع');
    assert.equal(branch?.qty.toFixed(0), '6');
    const main = after.rows.find((r) => r.warehouseAr === 'المستودع الرئيسي');
    assert.equal(main?.qty.toFixed(0), '10');
  });
});

test('تسوية الجرد بالنقص تُقيَّد مصروفاً', async () => {
  await withTenant(tenantId, async (tx) => {
    const cogs = await accountByRole(tx, tenantId, 'COGS');
    const before = await generalLedger(tx, tenantId, cogs.id, day(1, 1), day(12, 31));

    // المعدود ٩ والدفتري ١٠ ⇒ نقصٌ بواحد
    const res = await adjustStock(tx, tenantId, {
      itemId, warehouseId: mainWh, countedQty: 9, date: day(6, 1),
      reason: 'تلف أثناء المناولة',
    });

    assert.ok(res.adjusted);
    assert.equal(res.delta.toFixed(0), '-1');

    const after = await generalLedger(tx, tenantId, cogs.id, day(1, 1), day(12, 31));
    assert.equal(
      after.closing.minus(before.closing).toFixed(2),
      '3300.00',
      'النقص مصروفٌ بتكلفة المتوسط',
    );
  });
});

test('تسوية بلا فرق لا تُنشئ قيداً', async () => {
  await withTenant(tenantId, async (tx) => {
    const res = await adjustStock(tx, tenantId, {
      itemId, warehouseId: mainWh, countedQty: 9, date: day(6, 2), reason: 'جرد مطابق',
    });
    assert.equal(res.adjusted, false);
    assert.equal(res.entry, null);
  });
});

test('الخدمة لا تُتابع رصيداً', async () => {
  await withTenant(tenantId, async (tx) => {
    await assert.rejects(
      () => recordMove(tx, tenantId, {
        itemId: serviceId, warehouseId: mainWh, moveDate: day(6, 3), qty: 5, reason: 'PURCHASE',
      }),
      /خدمة ولا يُتابع رصيده/,
    );
  });
});

test('تنبيه حدّ إعادة الطلب يظهر في تقرير القيمة', async () => {
  await withTenant(tenantId, async (tx) => {
    const val = await stockValuation(tx, tenantId, branchWh);
    const row = val.rows.find((r) => r.sku === 'LAP-001');
    // ٦ في الفرع وحدّ الطلب ٥ ⇒ فوق الحدّ
    assert.equal(row?.belowReorder, false);
  });
});

test('الأرصدة المحفوظة تطابق مجموع الحركات — لا انحراف', async () => {
  await withTenant(tenantId, async (tx) => {
    const drift = await reconcileStock(tx, tenantId);
    assert.deepEqual(drift, [], `انحراف في الأرصدة: ${JSON.stringify(drift)}`);
  });
});

test('قيمة حساب المخزون في الأستاذ تساوي قيمة المخزون الفعلية', async () => {
  await withTenant(tenantId, async (tx) => {
    const invAcc = await accountByRole(tx, tenantId, 'INVENTORY');
    const ledger = await generalLedger(tx, tenantId, invAcc.id, day(1, 1), day(12, 31));
    const valuation = await stockValuation(tx, tenantId);

    assert.equal(
      ledger.closing.toFixed(2),
      valuation.totalValue.toFixed(2),
      'الأستاذ والمستودع يقولان رقمين مختلفين — وهذا ما يُكتشف عادةً في الجرد السنوي',
    );
  });
});

test('الميزان يتزن والدفتر سليم', async () => {
  await withTenant(tenantId, async (tx) => {
    const tb = await trialBalance(tx, tenantId, day(1, 1), day(12, 31));
    assert.equal(tb.totals.closingDebit.toFixed(2), tb.totals.closingCredit.toFixed(2));
    assert.deepEqual(await auditLedgerIntegrity(tx, tenantId), []);
  });
});
