/**
 * المخزون وتكلفته بالمتوسط المرجّح.
 *
 * المتوسط المرجّح يعني: تكلفةُ الوحدة بعد كل استلام هي (قيمة المخزون
 * القائم + قيمة الوارد) ÷ (كمية القائم + كمية الوارد). ما يُصرف بعدها
 * يخرج بهذه التكلفة، وقيمة الحركة تُثبَّت فيها لحظة الصرف — لأن المتوسط
 * سيتغيّر مع الاستلام التالي، ومن يقرأ التكلفة من الصنف لاحقاً يقرأ رقماً
 * غير الذي رُحِّل.
 *
 * ثلاثة أرقام تصف الرصيد ويجب أن تتّفق دائماً:
 *   ـ `StockMove` مجموع الحركات — وهو المرجع.
 *   ـ `StockLevel` الرصيد المحفوظ لكل صنف في مستودع — للسرعة.
 *   ـ `Item.onHand` الرصيد الكلي — للعرض السريع.
 * `reconcileStock` تقارن الثلاثة وتكشف أي انحراف بدل أن يُكتشف في الجرد.
 *
 * الرصيد السالب ممنوع افتراضياً للأصناف المخزنية: صرفُ ما ليس موجوداً
 * يجعل المتوسط بلا معنى (قسمة على كمية سالبة)، والقيمة الدفترية للمخزون
 * تصير رقماً لا يقابله شيء في المستودع.
 */
import type { Tx } from '../db.ts';
import { d, money, qty as q, Decimal, type Num } from '../money.ts';
import { DomainError, ValidationError } from '../errors.ts';
import { postEntry, accountByRole } from '../accounting/posting.ts';

export type MoveReason =
  | 'PURCHASE' | 'SALE' | 'ADJUSTMENT'
  | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'OPENING' | 'RETURN';

/**
 * يحسب المتوسط الجديد بعد استلام.
 *
 * مُصدَّرة ومحضة لتُختبر وحدها: هذه الصيغة هي التي تحدّد قيمة المخزون في
 * الميزانية، وخطأٌ فيها لا يظهر إلا في الجرد السنوي.
 */
export function newAverageCost(
  onHand: Num,
  currentAvg: Num,
  incomingQty: Num,
  incomingCost: Num,
): Decimal {
  const h = d(onHand);
  const inQ = d(incomingQty);
  const total = h.plus(inQ);

  if (total.lessThanOrEqualTo(0)) {
    // لا رصيد بعد الحركة: المتوسط يُعاد إلى تكلفة الوارد لا إلى صفر،
    // فصفرٌ يجعل أول صرفٍ بعدها بلا تكلفة.
    return money(incomingCost);
  }

  const value = h.times(d(currentAvg)).plus(inQ.times(d(incomingCost)));
  return money(value.dividedBy(total));
}

async function upsertLevel(tx: Tx, tenantId: string, itemId: string, warehouseId: string, delta: Decimal) {
  const level = await tx.stockLevel.findUnique({
    where: { itemId_warehouseId: { itemId, warehouseId } },
  });

  const next = q(d(level?.qty ?? 0).plus(delta));

  if (level) {
    await tx.stockLevel.update({ where: { id: level.id }, data: { qty: next.toFixed(6) } });
  } else {
    await tx.stockLevel.create({
      data: { tenantId, itemId, warehouseId, qty: next.toFixed(6) },
    });
  }

  return next;
}

export type MoveInput = {
  itemId: string;
  warehouseId: string;
  moveDate: Date;
  /** موجب وارد، سالب صادر */
  qty: Num;
  /** تكلفة الوحدة — للوارد فقط؛ الصادر يأخذ المتوسط الجاري */
  unitCost?: Num;
  reason: MoveReason;
  goodsReceiptId?: string | null;
  salesInvoiceId?: string | null;
  journalEntryId?: string | null;
  notesAr?: string | null;
  createdBy?: string;
  /** يسمح بالرصيد السالب — للتسويات المصحِّحة وحدها */
  allowNegative?: boolean;
};

/**
 * يسجّل حركة مخزون ويحدّث المتوسط والأرصدة.
 *
 * لا يولّد قيداً بنفسه: القيد يخصّ سياق الحركة (شراء، بيع، تسوية) ويُبنى
 * في دالّته. الفصل يمنع قيداً مكرّراً حين تُستدعى الحركة من مسارٍ يولّد
 * قيده بنفسه.
 */
export async function recordMove(tx: Tx, tenantId: string, input: MoveInput) {
  const item = await tx.item.findFirst({ where: { id: input.itemId, tenantId } });
  if (!item) throw new DomainError('الصنف غير موجود', 'NOT_FOUND');

  if (item.kind !== 'STOCK') {
    throw new ValidationError(
      `«${item.nameAr}» ${item.kind === 'SERVICE' ? 'خدمة' : 'مستهلك'} ولا يُتابع رصيده.`,
    );
  }

  const warehouse = await tx.warehouse.findFirst({ where: { id: input.warehouseId, tenantId } });
  if (!warehouse) throw new DomainError('المستودع غير موجود', 'NOT_FOUND');

  const moveQty = q(input.qty);
  if (moveQty.isZero()) throw new ValidationError('كمية الحركة صفر.');

  const isInbound = moveQty.greaterThan(0);

  // ── الصادر: يخرج بالمتوسط الجاري، ويُمنع من تجاوز الرصيد
  let unitCost: Decimal;
  if (isInbound) {
    unitCost = money(input.unitCost ?? item.purchasePrice);
    if (unitCost.isNegative()) throw new ValidationError('تكلفة الوحدة سالبة.');
  } else {
    unitCost = money(item.avgCost);

    if (!input.allowNegative) {
      const level = await tx.stockLevel.findUnique({
        where: { itemId_warehouseId: { itemId: input.itemId, warehouseId: input.warehouseId } },
      });
      const available = d(level?.qty ?? 0);
      if (available.plus(moveQty).lessThan(0)) {
        throw new DomainError(
          `رصيد «${item.nameAr}» في «${warehouse.nameAr}» ${available.toFixed(2)} ` +
            `ولا يكفي لصرف ${moveQty.abs().toFixed(2)}. ` +
            `صرفُ ما ليس موجوداً يُفسد تكلفة المتوسط وقيمة المخزون في الميزانية.`,
          'INSUFFICIENT_STOCK',
          { available: available.toFixed(6), requested: moveQty.abs().toFixed(6) },
        );
      }
    }
  }

  const value = money(moveQty.times(unitCost));

  const move = await tx.stockMove.create({
    data: {
      tenantId,
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      moveDate: input.moveDate,
      qty: moveQty.toFixed(6),
      unitCost: unitCost.toFixed(6),
      value: value.toFixed(6),
      reason: input.reason,
      goodsReceiptId: input.goodsReceiptId ?? null,
      salesInvoiceId: input.salesInvoiceId ?? null,
      journalEntryId: input.journalEntryId ?? null,
      notesAr: input.notesAr ?? null,
      createdBy: input.createdBy ?? null,
    },
  });

  await upsertLevel(tx, tenantId, input.itemId, input.warehouseId, moveQty);

  // المتوسط يتغيّر بالوارد وحده؛ الصادر يستهلكه ولا يعدّله.
  const nextAvg = isInbound
    ? newAverageCost(item.onHand, item.avgCost, moveQty, unitCost)
    : money(item.avgCost);

  await tx.item.update({
    where: { id: item.id },
    data: {
      onHand: q(d(item.onHand).plus(moveQty)).toFixed(6),
      avgCost: nextAvg.toFixed(6),
    },
  });

  return { move, unitCost, value, newAvgCost: nextAvg };
}

/**
 * استلام بضاعة: يسجّل الحركات ويرحّل القيد.
 *
 *   من ح/ المخزون                    بقيمة الاستلام
 *     إلى ح/ بضاعة مستلمة لم تُفوتر   بالقيمة نفسها
 *
 * حساب «بضاعة مستلمة لم تُفوتر» هو ما يجعل الميزانية صادقة بين الاستلام
 * والفاتورة: البضاعة في المستودع فعلاً، والالتزام قائم فعلاً، ولو انتظرنا
 * الفاتورة لظهرت الميزانية ناقصةً أصلاً والتزاماً معاً.
 */
export async function postGoodsReceipt(tx: Tx, tenantId: string, receiptId: string, actor?: string) {
  const receipt = await tx.goodsReceipt.findFirst({
    where: { id: receiptId, tenantId },
    include: { lines: { include: { item: true } }, partner: true, warehouse: true },
  });
  if (!receipt) throw new DomainError('إشعار الاستلام غير موجود', 'NOT_FOUND');
  if (receipt.status !== 'DRAFT') {
    throw new DomainError(`الإشعار ${receipt.number} حالته «${receipt.status}».`, 'NOT_DRAFT');
  }
  if (!receipt.lines.length) throw new ValidationError('إشعار الاستلام بلا سطور.');

  const inventoryAcc = await accountByRole(tx, tenantId, 'INVENTORY');
  const grniAcc = await accountByRole(tx, tenantId, 'GRNI');

  let totalValue = new Decimal(0);
  const perAccount = new Map<string, Decimal>();

  for (const line of receipt.lines) {
    const { value } = await recordMove(tx, tenantId, {
      itemId: line.itemId,
      warehouseId: receipt.warehouseId,
      moveDate: receipt.receiptDate,
      qty: line.qty,
      unitCost: line.unitCost,
      reason: 'PURCHASE',
      goodsReceiptId: receipt.id,
      createdBy: actor,
    });

    const accId = line.item.inventoryAccountId ?? inventoryAcc.id;
    perAccount.set(accId, (perAccount.get(accId) ?? new Decimal(0)).plus(value));
    totalValue = totalValue.plus(value);
  }

  const lines: Record<string, unknown>[] = [];
  for (const [accountId, amount] of perAccount) {
    lines.push({
      accountId,
      debit: money(amount),
      descAr: `استلام ${receipt.number} — ${receipt.warehouse.nameAr}`,
      partnerId: receipt.partnerId,
    });
  }
  lines.push({
    accountId: grniAcc.id,
    credit: money(totalValue),
    descAr: `بضاعة مستلمة لم تُفوتر — ${receipt.partner.nameAr}`,
    partnerId: receipt.partnerId,
  });

  const entry = await postEntry(tx, tenantId, {
    date: receipt.receiptDate,
    memoAr: `استلام بضاعة ${receipt.number}`,
    ref: receipt.number,
    sourceType: 'GOODS_RECEIPT',
    sourceId: receipt.id,
    createdBy: actor,
    lines: lines as never,
  });

  await tx.stockMove.updateMany({
    where: { goodsReceiptId: receipt.id },
    data: { journalEntryId: entry.id },
  });

  return tx.goodsReceipt.update({
    where: { id: receipt.id },
    data: { status: 'POSTED', journalEntryId: entry.id },
  });
}

/**
 * صرف البضاعة المباعة وقيد تكلفتها.
 *
 *   من ح/ تكلفة البضاعة المباعة   بتكلفة المصروف
 *     إلى ح/ المخزون               بالقيمة نفسها
 *
 * قيدٌ مستقلٌّ عن قيد الفاتورة عمداً: الفاتورة إيرادٌ وذمّة، وهذا تكلفةٌ
 * ومخزون. دمجهما يجعل عكس أحدهما دون الآخر مستحيلاً.
 */
export async function issueStockForInvoice(
  tx: Tx,
  tenantId: string,
  invoiceId: string,
  warehouseId: string,
  actor?: string,
) {
  const invoice = await tx.salesInvoice.findFirstOrThrow({
    where: { id: invoiceId, tenantId },
    include: { lines: { include: { item: true } } },
  });

  const stockLines = invoice.lines.filter((l) => l.item?.kind === 'STOCK');
  if (!stockLines.length) return null;

  const isReturn = invoice.docType === 'CREDIT_NOTE';
  const cogsAcc = await accountByRole(tx, tenantId, 'COGS');
  const inventoryAcc = await accountByRole(tx, tenantId, 'INVENTORY');

  let totalCost = new Decimal(0);

  for (const line of stockLines) {
    const moveQty = isReturn ? d(line.qty) : d(line.qty).negated();
    const { value } = await recordMove(tx, tenantId, {
      itemId: line.itemId!,
      warehouseId,
      moveDate: invoice.issueDate,
      qty: moveQty,
      // المرتجع يعود بمتوسط الصنف الجاري
      unitCost: isReturn ? line.item!.avgCost : undefined,
      reason: isReturn ? 'RETURN' : 'SALE',
      salesInvoiceId: invoice.id,
      createdBy: actor,
    });
    totalCost = totalCost.plus(value.abs());
  }

  if (totalCost.isZero()) return null;

  const entry = await postEntry(tx, tenantId, {
    date: invoice.issueDate,
    memoAr: `تكلفة ${isReturn ? 'مرتجع' : 'البضاعة المباعة'} — ${invoice.number}`,
    ref: invoice.number,
    sourceType: 'STOCK_MOVE',
    sourceId: invoice.id,
    createdBy: actor,
    lines: [
      {
        accountId: isReturn ? inventoryAcc.id : cogsAcc.id,
        debit: money(totalCost),
        descAr: `تكلفة ${invoice.number}`,
        partnerId: invoice.partnerId,
        projectId: invoice.projectId,
      },
      {
        accountId: isReturn ? cogsAcc.id : inventoryAcc.id,
        credit: money(totalCost),
        descAr: `تكلفة ${invoice.number}`,
        partnerId: invoice.partnerId,
        projectId: invoice.projectId,
      },
    ] as never,
  });

  await tx.stockMove.updateMany({
    where: { salesInvoiceId: invoice.id, journalEntryId: null },
    data: { journalEntryId: entry.id },
  });

  return entry;
}

/**
 * تسوية جرد: تصحّح الرصيد الدفتري إلى الرصيد الفعلي وتُرحّل الفرق.
 *
 * الزيادة تُقيَّد أصلاً (مخزونٌ لم يكن مسجَّلاً)، والنقص مصروفاً — لأنه
 * تلفٌ أو فقدٌ لا يعود.
 */
export async function adjustStock(
  tx: Tx,
  tenantId: string,
  input: {
    itemId: string;
    warehouseId: string;
    /** الرصيد الفعلي المعدود */
    countedQty: Num;
    date: Date;
    reason: string;
    unitCost?: Num;
    actor?: string;
  },
) {
  const item = await tx.item.findFirstOrThrow({ where: { id: input.itemId, tenantId } });
  const level = await tx.stockLevel.findUnique({
    where: { itemId_warehouseId: { itemId: input.itemId, warehouseId: input.warehouseId } },
  });

  const bookQty = d(level?.qty ?? 0);
  const delta = q(d(input.countedQty).minus(bookQty));

  if (delta.isZero()) {
    return { adjusted: false, delta, entry: null };
  }

  const { value } = await recordMove(tx, tenantId, {
    itemId: input.itemId,
    warehouseId: input.warehouseId,
    moveDate: input.date,
    qty: delta,
    unitCost: input.unitCost ?? item.avgCost,
    reason: 'ADJUSTMENT',
    notesAr: input.reason,
    createdBy: input.actor,
    allowNegative: true,
  });

  const inventoryAcc = item.inventoryAccountId
    ? await tx.account.findFirstOrThrow({ where: { id: item.inventoryAccountId, tenantId } })
    : await accountByRole(tx, tenantId, 'INVENTORY');
  const counterAcc = await accountByRole(tx, tenantId, 'COGS');

  const amount = money(value.abs());
  const isIncrease = delta.greaterThan(0);

  const entry = await postEntry(tx, tenantId, {
    date: input.date,
    memoAr: `تسوية جرد — ${item.nameAr}: ${input.reason}`,
    sourceType: 'ADJUSTMENT',
    sourceId: `${input.itemId}:${input.warehouseId}:${input.date.toISOString().slice(0, 10)}`,
    createdBy: input.actor,
    lines: [
      {
        accountId: isIncrease ? inventoryAcc.id : counterAcc.id,
        debit: amount,
        descAr: input.reason,
      },
      {
        accountId: isIncrease ? counterAcc.id : inventoryAcc.id,
        credit: amount,
        descAr: input.reason,
      },
    ] as never,
  });

  return { adjusted: true, delta, entry };
}

/** تحويل بين مستودعين — حركتان بلا قيد، فالقيمة لم تتغيّر. */
export async function transferStock(
  tx: Tx,
  tenantId: string,
  input: { itemId: string; fromWarehouseId: string; toWarehouseId: string; qty: Num; date: Date; actor?: string },
) {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new ValidationError('المستودع المصدر والوجهة واحد.');
  }
  const amount = q(input.qty);
  if (!amount.greaterThan(0)) throw new ValidationError('كمية التحويل يجب أن تكون موجبة.');

  const out = await recordMove(tx, tenantId, {
    itemId: input.itemId, warehouseId: input.fromWarehouseId, moveDate: input.date,
    qty: amount.negated(), reason: 'TRANSFER_OUT', createdBy: input.actor,
  });

  const inn = await recordMove(tx, tenantId, {
    itemId: input.itemId, warehouseId: input.toWarehouseId, moveDate: input.date,
    qty: amount, unitCost: out.unitCost, reason: 'TRANSFER_IN', createdBy: input.actor,
  });

  return { out: out.move, in: inn.move };
}

/** تقرير قيمة المخزون: الكمية والتكلفة والقيمة لكل صنف ومستودع. */
export async function stockValuation(tx: Tx, tenantId: string, warehouseId?: string) {
  const levels = await tx.stockLevel.findMany({
    where: { tenantId, ...(warehouseId ? { warehouseId } : {}) },
    include: { item: true, warehouse: true },
    orderBy: { item: { sku: 'asc' } },
  });

  const rows = levels
    .filter((l) => !d(l.qty).isZero())
    .map((l) => ({
      sku: l.item.sku,
      nameAr: l.item.nameAr,
      warehouseAr: l.warehouse.nameAr,
      qty: q(l.qty),
      avgCost: money(l.item.avgCost),
      value: money(d(l.qty).times(d(l.item.avgCost))),
      belowReorder: d(l.qty).lessThan(d(l.item.reorderPoint)),
    }));

  return {
    rows,
    totalValue: money(rows.reduce((s, r) => s.plus(r.value), new Decimal(0))),
  };
}

/**
 * مطابقة الأرصدة: يقارن الحركات بالأرصدة المحفوظة.
 *
 * ليس ترفاً: الرصيد المحفوظ موجودٌ للسرعة، وأي عطبٍ يجعله يفارق الحركات
 * بلا أن يشتكي أحد — حتى يأتي الجرد فيجد فرقاً لا أحد يعرف متى بدأ.
 * تُشغَّل مجدولةً وقبل إقفال السنة.
 */
export async function reconcileStock(tx: Tx, tenantId: string) {
  const drift = await tx.$queryRaw<
    { itemId: string; sku: string; nameAr: string; warehouseId: string; warehouseAr: string; movesQty: string; levelQty: string }[]
  >`
    SELECT i."id" AS "itemId", i."sku", i."nameAr",
           w."id" AS "warehouseId", w."nameAr" AS "warehouseAr",
           COALESCE(SUM(m."qty"), 0)::text AS "movesQty",
           COALESCE(MAX(sl."qty"), 0)::text AS "levelQty"
    FROM "StockLevel" sl
    JOIN "Item" i ON i."id" = sl."itemId"
    JOIN "Warehouse" w ON w."id" = sl."warehouseId"
    LEFT JOIN "StockMove" m ON m."itemId" = sl."itemId" AND m."warehouseId" = sl."warehouseId"
    WHERE sl."tenantId" = ${tenantId}
    GROUP BY i."id", i."sku", i."nameAr", w."id", w."nameAr", sl."qty"
    HAVING COALESCE(SUM(m."qty"), 0) <> sl."qty"
  `;

  return drift.map((r) => ({
    sku: r.sku,
    nameAr: r.nameAr,
    warehouseAr: r.warehouseAr,
    fromMoves: q(r.movesQty),
    stored: q(r.levelQty),
    difference: q(d(r.movesQty).minus(d(r.levelQty))),
  }));
}
