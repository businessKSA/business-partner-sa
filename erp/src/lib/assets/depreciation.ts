/**
 * الأصول الثابتة والاستهلاك.
 *
 * الاستهلاك ليس رأياً محاسبياً يُراجَع كل شهر: هو صيغةٌ تُطبَّق بانتظام،
 * ومنشأةٌ تحسبه يدوياً في جدول تنساه شهراً فتُظهر ربحاً أعلى من حقيقته، ثم
 * تُصحّحه دفعةً واحدة في آخر السنة فيبدو الشهر الأخير خاسراً بلا سبب.
 *
 * ثلاث طرق مدعومة، وكلٌّ منها دالّة محضة تُختبر وحدها لأنها تحدّد قيمة
 * الأصول في الميزانية:
 *
 *  ـ **القسط الثابت**: (التكلفة − التخريدية) ÷ العمر بالأشهر. القسط نفسه كل
 *    شهر، وهو الأنسب لأصلٍ يُستهلك بالزمن (مبنى، أثاث).
 *  ـ **القسط المتناقص**: نسبةٌ من القيمة الدفترية المتبقّية، فيكون القسط
 *    أكبر في السنوات الأولى. الأنسب لأصلٍ يفقد قيمته سريعاً (حاسبات، سيارات).
 *  ـ **وحدات الإنتاج**: بحسب ما استُهلك من طاقة الأصل، لا بالزمن. الأنسب
 *    لآلةٍ يتفاوت تشغيلها.
 *
 * وقاعدةٌ تحكم الثلاث: **لا يُستهلك الأصل دون قيمته التخريدية**. الصيغة
 * المتناقصة خصوصاً تُنتج قسطاً يتجاوزها في الشهر الأخير، ومن لا يقصّه يُظهر
 * أصلاً بقيمة سالبة.
 */
import type { Tx } from '../db.ts';
import { d, money, Decimal, type Num } from '../money.ts';
import { DomainError, ValidationError } from '../errors.ts';
import { postEntry, reverseEntry, accountByRole } from '../accounting/posting.ts';
import { nextNumber } from '../accounting/numbering.ts';

export type Method = 'STRAIGHT_LINE' | 'DECLINING_BALANCE' | 'UNITS_OF_PRODUCTION';

export type DepreciableAsset = {
  cost: Num;
  salvageValue: Num;
  usefulLifeMonths: number;
  method: Method;
  decliningFactor?: Num;
  totalUnits?: Num | null;
  /** مجمَّع الاستهلاك قبل هذا الشهر */
  accumulated: Num;
};

/**
 * قسط شهرٍ واحد.
 *
 * دالّة محضة: لا تقرأ قاعدةً ولا تكتب فيها، فتُختبر بحالاتٍ محسوبة يدوياً.
 *
 * @param unitsThisPeriod وحدات الإنتاج في هذا الشهر — لطريقة الوحدات فقط
 */
export function monthlyDepreciation(asset: DepreciableAsset, unitsThisPeriod: Num = 0): Decimal {
  const cost = money(asset.cost);
  const salvage = money(asset.salvageValue);
  const accumulated = money(asset.accumulated);

  if (cost.lessThan(salvage)) {
    throw new ValidationError('القيمة التخريدية أكبر من تكلفة الأصل.');
  }
  if (asset.usefulLifeMonths <= 0) {
    throw new ValidationError('العمر الإنتاجي يجب أن يكون أكبر من صفر.');
  }

  const depreciableBase = cost.minus(salvage);
  const remaining = depreciableBase.minus(accumulated);

  // استُهلك بالكامل: لا قسط بعد اليوم.
  if (remaining.lessThanOrEqualTo(0)) return new Decimal(0);

  let raw: Decimal;

  switch (asset.method) {
    case 'STRAIGHT_LINE':
      raw = depreciableBase.dividedBy(asset.usefulLifeMonths);
      break;

    case 'DECLINING_BALANCE': {
      // النسبة السنوية = المعامل ÷ العمر بالسنوات، ثم تُقسم على اثني عشر.
      const factor = d(asset.decliningFactor ?? 2);
      const years = d(asset.usefulLifeMonths).dividedBy(12);
      if (years.lessThanOrEqualTo(0)) throw new ValidationError('العمر الإنتاجي غير صالح.');
      const monthlyRate = factor.dividedBy(years).dividedBy(12);
      // تُحسب على القيمة الدفترية (التكلفة − المجمَّع) لا على الوعاء القابل
      // للاستهلاك — وهذا ما يميّز الطريقة المتناقصة.
      raw = cost.minus(accumulated).times(monthlyRate);
      break;
    }

    case 'UNITS_OF_PRODUCTION': {
      const total = d(asset.totalUnits ?? 0);
      if (total.lessThanOrEqualTo(0)) {
        throw new ValidationError('طريقة وحدات الإنتاج تشترط إجمالي الوحدات المتوقَّعة.');
      }
      const units = d(unitsThisPeriod);
      if (units.isNegative()) throw new ValidationError('وحدات الإنتاج سالبة.');
      raw = depreciableBase.times(units).dividedBy(total);
      break;
    }
  }

  // القصّ عند المتبقّي: لا يُستهلك الأصل دون قيمته التخريدية.
  // الصيغة المتناقصة تتجاوزها في الشهر الأخير، ومن لا يقصّ يُظهر أصلاً سالباً.
  return money(raw.greaterThan(remaining) ? remaining : raw);
}

/** أول يوم من الشهر — مفتاح فترة الاستهلاك. */
function periodStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

/**
 * هل يستحقّ الأصل استهلاكاً في هذا الشهر؟
 *
 * لا يستحقّ قبل تشغيله، ولا بعد استبعاده، ولا مرّتين للشهر نفسه.
 */
export function isDue(
  asset: { inServiceDate: Date; status: string; lastDepreciatedOn: Date | null; disposalDate: Date | null },
  year: number,
  month: number,
): boolean {
  if (!['ACTIVE'].includes(asset.status)) return false;

  const start = periodStart(year, month);
  const end = new Date(Date.UTC(year, month, 0));

  // لم يُشغَّل بعد نهاية هذا الشهر
  if (asset.inServiceDate > end) return false;
  // استُبعد قبل بداية هذا الشهر
  if (asset.disposalDate && asset.disposalDate < start) return false;
  // استُهلك هذا الشهر سلفاً
  if (asset.lastDepreciatedOn && asset.lastDepreciatedOn >= start) return false;

  return true;
}

export type AssetInput = {
  code?: string;
  nameAr: string;
  nameEn?: string | null;
  categoryAr?: string | null;
  serialNumber?: string | null;
  location?: string | null;
  purchaseDate: Date;
  inServiceDate?: Date;
  cost: Num;
  salvageValue?: Num;
  usefulLifeMonths: number;
  method?: Method;
  decliningFactor?: Num;
  totalUnits?: Num | null;
  assetAccountId?: string | null;
  accumulatedAccountId?: string | null;
  expenseAccountId?: string | null;
  costCenterId?: string | null;
  projectId?: string | null;
  createdBy?: string;
};

export async function createAsset(tx: Tx, tenantId: string, input: AssetInput) {
  const cost = money(input.cost);
  if (!cost.greaterThan(0)) throw new ValidationError('تكلفة الأصل يجب أن تكون موجبة.');

  const salvage = money(input.salvageValue ?? 0);
  if (salvage.greaterThan(cost)) {
    throw new ValidationError('القيمة التخريدية أكبر من التكلفة.');
  }
  if (input.usefulLifeMonths <= 0) {
    throw new ValidationError('العمر الإنتاجي بالأشهر يجب أن يكون أكبر من صفر.');
  }

  const inService = input.inServiceDate ?? input.purchaseDate;
  if (inService < input.purchaseDate) {
    throw new ValidationError('تاريخ التشغيل قبل تاريخ الشراء.');
  }

  // الحسابات الافتراضية بأدوارها الوظيفية حين لا تُحدَّد
  const assetAccountId =
    input.assetAccountId ?? (await accountByRole(tx, tenantId, 'FIXED_ASSET')).id;
  const accumulatedAccountId =
    input.accumulatedAccountId ?? (await accountByRole(tx, tenantId, 'ACCUM_DEPRECIATION')).id;
  const expenseAccountId =
    input.expenseAccountId ?? (await accountByRole(tx, tenantId, 'DEPRECIATION')).id;

  const code = input.code ?? (await nextAssetCode(tx, tenantId));

  return tx.fixedAsset.create({
    data: {
      tenantId,
      code,
      nameAr: input.nameAr,
      nameEn: input.nameEn ?? null,
      categoryAr: input.categoryAr ?? null,
      serialNumber: input.serialNumber ?? null,
      location: input.location ?? null,
      purchaseDate: input.purchaseDate,
      inServiceDate: inService,
      cost: cost.toFixed(6),
      salvageValue: salvage.toFixed(6),
      usefulLifeMonths: input.usefulLifeMonths,
      method: input.method ?? 'STRAIGHT_LINE',
      decliningFactor: d(input.decliningFactor ?? 2).toFixed(4),
      totalUnits: input.totalUnits != null ? d(input.totalUnits).toFixed(6) : null,
      assetAccountId,
      accumulatedAccountId,
      expenseAccountId,
      costCenterId: input.costCenterId ?? null,
      projectId: input.projectId ?? null,
      createdBy: input.createdBy ?? null,
    },
  });
}

async function nextAssetCode(tx: Tx, tenantId: string): Promise<string> {
  const last = await tx.fixedAsset.findFirst({
    where: { tenantId },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const n = last ? Number(last.code.replace(/\D/g, '')) + 1 : 1;
  return `FA-${String(n).padStart(4, '0')}`;
}

/**
 * يولّد مسيّر استهلاك الشهر: يحسب قسط كل أصل مستحقّ ويحفظه مسوّدة.
 *
 * لا يُرحَّل هنا — الفصل بين الحساب والترحيل مقصود كما في الرواتب: المسيّر
 * يُراجَع، ثم يُرحَّل، ولا رجعة بعده إلا بقيدٍ عاكس.
 */
export async function generateDepreciationRun(
  tx: Tx,
  tenantId: string,
  year: number,
  month: number,
  opts: { unitsByAsset?: Record<string, Num>; createdBy?: string } = {},
) {
  if (month < 1 || month > 12) throw new ValidationError('الشهر يجب أن يكون بين ١ و١٢.');

  const existing = await tx.depreciationRun.findUnique({
    where: { tenantId_year_month: { tenantId, year, month } },
  });
  if (existing && existing.status !== 'CANCELLED') {
    throw new DomainError(
      `مسيّر استهلاك ${month}/${year} موجود بالرقم ${existing.number} وحالته «${existing.status}».`,
      'DEPRECIATION_RUN_EXISTS',
    );
  }

  const assets = await tx.fixedAsset.findMany({
    where: { tenantId, status: 'ACTIVE' },
    orderBy: { code: 'asc' },
  });

  const period = periodStart(year, month);
  const runDate = new Date(Date.UTC(year, month, 0)); // آخر يوم في الشهر
  const number = await nextNumber(tx, tenantId, 'DEPRECIATION', runDate);

  const rows: {
    tenantId: string; assetId: string; period: Date;
    amount: string; bookValueAfter: string;
  }[] = [];
  let total = new Decimal(0);

  for (const a of assets) {
    if (!isDue(a, year, month)) continue;

    const amount = monthlyDepreciation(
      {
        cost: a.cost,
        salvageValue: a.salvageValue,
        usefulLifeMonths: a.usefulLifeMonths,
        method: a.method,
        decliningFactor: a.decliningFactor,
        totalUnits: a.totalUnits,
        accumulated: a.accumulated,
      },
      opts.unitsByAsset?.[a.id] ?? 0,
    );

    if (amount.isZero()) continue;

    const bookValueAfter = money(d(a.cost).minus(d(a.accumulated)).minus(amount));
    rows.push({
      tenantId,
      assetId: a.id,
      period,
      amount: amount.toFixed(6),
      bookValueAfter: bookValueAfter.toFixed(6),
    });
    total = total.plus(amount);
  }

  if (!rows.length) {
    throw new ValidationError(
      `لا أصول مستحقّة للاستهلاك في ${month}/${year} — راجِع تواريخ التشغيل وحالات الأصول.`,
    );
  }

  return tx.depreciationRun.create({
    data: {
      tenantId, number, year, month, runDate,
      assetCount: rows.length,
      totalAmount: money(total).toFixed(6),
      createdBy: opts.createdBy ?? null,
      entries: { create: rows.map(({ tenantId: _t, ...r }) => ({ tenantId, ...r })) },
    },
    include: { entries: { include: { asset: true } } },
  });
}

/**
 * يرحّل مسيّر الاستهلاك:
 *   من ح/ مصروف الاستهلاك    بقسط الشهر
 *     إلى ح/ مجمَّع الاستهلاك  بالقسط نفسه
 *
 * ومجمَّع الاستهلاك حسابٌ مقابل للأصل (contra-asset): يزيد دائناً فيُنقص
 * قيمة الأصل في الميزانية دون أن يمسّ تكلفته التاريخية — وهذا ما يُبقي
 * التكلفة الأصلية ظاهرةً للمدقّق.
 */
export async function postDepreciationRun(
  tx: Tx,
  tenantId: string,
  runId: string,
  actor?: string,
) {
  const run = await tx.depreciationRun.findFirst({
    where: { id: runId, tenantId },
    include: { entries: { include: { asset: true } } },
  });
  if (!run) throw new DomainError('مسيّر الاستهلاك غير موجود', 'NOT_FOUND');
  if (run.status !== 'DRAFT') {
    throw new DomainError(`المسيّر ${run.number} حالته «${run.status}».`, 'NOT_DRAFT');
  }

  // تُجمَّع السطور بحساب المصروف وحساب المجمَّع، فيخرج قيدٌ مقروء بدل
  // سطرين لكل أصل.
  const byExpense = new Map<string, Decimal>();
  const byAccumulated = new Map<string, Decimal>();

  for (const e of run.entries) {
    const amount = money(e.amount);
    const exp = e.asset.expenseAccountId!;
    const acc = e.asset.accumulatedAccountId!;
    byExpense.set(exp, (byExpense.get(exp) ?? new Decimal(0)).plus(amount));
    byAccumulated.set(acc, (byAccumulated.get(acc) ?? new Decimal(0)).plus(amount));
  }

  const lines: Record<string, unknown>[] = [];
  for (const [accountId, amount] of byExpense) {
    lines.push({
      accountId, debit: money(amount),
      descAr: `استهلاك ${run.month}/${run.year}`,
    });
  }
  for (const [accountId, amount] of byAccumulated) {
    lines.push({
      accountId, credit: money(amount),
      descAr: `مجمَّع الاستهلاك ${run.month}/${run.year}`,
    });
  }

  const entry = await postEntry(tx, tenantId, {
    date: run.runDate,
    memoAr: `استهلاك الأصول الثابتة ${run.month}/${run.year} — ${run.number}`,
    ref: run.number,
    sourceType: 'DEPRECIATION',
    sourceId: run.id,
    createdBy: actor,
    lines: lines as never,
  });

  // تحديث كل أصل: المجمَّع، وآخر شهر استُهلك، والحالة عند اكتمال الاستهلاك
  for (const e of run.entries) {
    const accumulated = money(d(e.asset.accumulated).plus(d(e.amount)));
    const depreciableBase = money(d(e.asset.cost).minus(d(e.asset.salvageValue)));
    const done = accumulated.greaterThanOrEqualTo(depreciableBase);

    await tx.fixedAsset.update({
      where: { id: e.assetId },
      data: {
        accumulated: accumulated.toFixed(6),
        lastDepreciatedOn: e.period,
        ...(done ? { status: 'FULLY_DEPRECIATED' } : {}),
      },
    });
  }

  await tx.depreciationEntry.updateMany({
    where: { runId: run.id },
    data: { journalEntryId: entry.id },
  });

  return tx.depreciationRun.update({
    where: { id: run.id },
    data: { status: 'POSTED', journalEntryId: entry.id, postedAt: new Date() },
    include: { entries: true },
  });
}

/**
 * استبعاد أصل: بيعاً أو تخريداً.
 *
 * القيد يُخرج الأصل ومجمَّعه من الدفاتر، ويُثبت الفرق بين المتحصَّل والقيمة
 * الدفترية ربحاً أو خسارة:
 *
 *   من ح/ مجمَّع الاستهلاك   بالمجمَّع
 *   من ح/ البنك              بالمتحصَّل
 *     إلى ح/ الأصل            بالتكلفة
 *     والفرق ربحٌ أو خسارة
 */
export async function disposeAsset(
  tx: Tx,
  tenantId: string,
  assetId: string,
  input: {
    disposalDate: Date;
    proceeds?: Num;
    /** الحساب الذي دخل فيه المتحصَّل — بنك أو ذمم */
    proceedsAccountId?: string | null;
    note?: string;
    actor?: string;
  },
) {
  const asset = await tx.fixedAsset.findFirst({ where: { id: assetId, tenantId } });
  if (!asset) throw new DomainError('الأصل غير موجود', 'NOT_FOUND');
  if (['DISPOSED', 'SOLD'].includes(asset.status)) {
    throw new DomainError(`الأصل ${asset.code} مستبعَد سلفاً.`, 'ALREADY_DISPOSED');
  }
  if (input.disposalDate < asset.inServiceDate) {
    throw new ValidationError('تاريخ الاستبعاد قبل تاريخ تشغيل الأصل.');
  }

  const cost = money(asset.cost);
  const accumulated = money(asset.accumulated);
  const bookValue = money(cost.minus(accumulated));
  const proceeds = money(input.proceeds ?? 0);
  const gain = money(proceeds.minus(bookValue));

  const lines: Record<string, unknown>[] = [];

  if (!accumulated.isZero()) {
    lines.push({
      accountId: asset.accumulatedAccountId!,
      debit: accumulated,
      descAr: `إخراج مجمَّع استهلاك ${asset.nameAr}`,
    });
  }

  if (proceeds.greaterThan(0)) {
    const acc = input.proceedsAccountId ?? (await accountByRole(tx, tenantId, 'BANK')).id;
    lines.push({ accountId: acc, debit: proceeds, descAr: `متحصَّل بيع ${asset.nameAr}` });
  }

  lines.push({
    accountId: asset.assetAccountId!,
    credit: cost,
    descAr: `إخراج تكلفة ${asset.nameAr}`,
  });

  if (!gain.isZero()) {
    // الربح إيرادٌ آخر، والخسارة مصروفٌ آخر — لا يُخلطان بإيراد النشاط.
    const role = gain.greaterThan(0) ? 'OTHER_INCOME' : 'OPERATING';
    const acc = await accountByRole(tx, tenantId, role);
    lines.push({
      accountId: acc.id,
      [gain.greaterThan(0) ? 'credit' : 'debit']: gain.abs(),
      descAr: gain.greaterThan(0)
        ? `ربح استبعاد ${asset.nameAr}`
        : `خسارة استبعاد ${asset.nameAr}`,
    });
  }

  const entry = await postEntry(tx, tenantId, {
    date: input.disposalDate,
    memoAr: `استبعاد أصل ثابت — ${asset.nameAr}${input.note ? ` (${input.note})` : ''}`,
    ref: asset.code,
    sourceType: 'ASSET_DISPOSAL',
    sourceId: asset.id,
    createdBy: input.actor,
    lines: lines as never,
  });

  const updated = await tx.fixedAsset.update({
    where: { id: asset.id },
    data: {
      status: proceeds.greaterThan(0) ? 'SOLD' : 'DISPOSED',
      disposalDate: input.disposalDate,
      disposalProceeds: proceeds.toFixed(6),
      disposalNote: input.note ?? null,
    },
  });

  return { asset: updated, entry, bookValue, gain };
}

/** يلغي مسيّراً مرحَّلاً: يعكس قيده ويردّ المجمَّع على كل أصل. */
export async function cancelDepreciationRun(
  tx: Tx,
  tenantId: string,
  runId: string,
  opts: { date?: Date; reason?: string; actor?: string } = {},
) {
  const run = await tx.depreciationRun.findFirst({
    where: { id: runId, tenantId },
    include: { entries: { include: { asset: true } } },
  });
  if (!run) throw new DomainError('مسيّر الاستهلاك غير موجود', 'NOT_FOUND');
  if (run.status === 'CANCELLED') throw new DomainError('ملغى سلفاً.', 'ALREADY_CANCELLED');

  if (run.journalEntryId) {
    await reverseEntry(tx, tenantId, run.journalEntryId, {
      date: opts.date ?? new Date(),
      memoAr: `إلغاء مسيّر استهلاك ${run.number}${opts.reason ? ` — ${opts.reason}` : ''}`,
      actor: opts.actor,
    });
  }

  // ردّ المجمَّع — وإلا بقي الأصل مستهلَكاً بقيدٍ ملغى
  for (const e of run.entries) {
    const back = money(d(e.asset.accumulated).minus(d(e.amount)));
    const prev = await tx.depreciationEntry.findFirst({
      where: { assetId: e.assetId, period: { lt: e.period } },
      orderBy: { period: 'desc' },
      select: { period: true },
    });
    await tx.fixedAsset.update({
      where: { id: e.assetId },
      data: {
        accumulated: back.toFixed(6),
        lastDepreciatedOn: prev?.period ?? null,
        ...(e.asset.status === 'FULLY_DEPRECIATED' ? { status: 'ACTIVE' } : {}),
      },
    });
  }

  await tx.depreciationEntry.deleteMany({ where: { runId: run.id } });

  return tx.depreciationRun.update({
    where: { id: run.id },
    data: { status: 'CANCELLED' },
  });
}

/**
 * سجلّ الأصول: التكلفة والمجمَّع والقيمة الدفترية لكل أصل.
 *
 * ومعه المطابقة: هل مجمَّع الأصول يساوي رصيد حساب مجمَّع الاستهلاك في
 * الأستاذ؟ الفرق يعني أن أصلاً عُدِّل خارج المحرّك.
 */
export async function assetRegister(tx: Tx, tenantId: string) {
  const assets = await tx.fixedAsset.findMany({
    where: { tenantId },
    orderBy: { code: 'asc' },
  });

  const rows = assets.map((a) => {
    const cost = money(a.cost);
    const accumulated = money(a.accumulated);
    const bookValue = money(cost.minus(accumulated));
    const active = a.status === 'ACTIVE' || a.status === 'FULLY_DEPRECIATED';
    return {
      id: a.id, code: a.code, nameAr: a.nameAr,
      categoryAr: a.categoryAr, status: a.status, method: a.method,
      inServiceDate: a.inServiceDate,
      usefulLifeMonths: a.usefulLifeMonths,
      cost, accumulated, bookValue,
      /** نسبة ما استُهلك من الوعاء القابل للاستهلاك */
      depreciatedPercent: cost.minus(money(a.salvageValue)).isZero()
        ? null
        : accumulated.dividedBy(cost.minus(money(a.salvageValue))).times(100).toDecimalPlaces(1),
      active,
    };
  });

  const onBooks = rows.filter((r) => r.active);

  return {
    rows,
    totalCost: money(onBooks.reduce((s, r) => s.plus(r.cost), new Decimal(0))),
    totalAccumulated: money(onBooks.reduce((s, r) => s.plus(r.accumulated), new Decimal(0))),
    totalBookValue: money(onBooks.reduce((s, r) => s.plus(r.bookValue), new Decimal(0))),
  };
}
