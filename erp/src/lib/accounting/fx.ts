/**
 * تعدّد العملات وفروق الصرف.
 *
 * الريال مربوطٌ بالدولار، فتظنّ منشأةٌ كثيرة أن العملات لا تعنيها. لكن أي
 * تعامل باليورو أو الجنيه أو الروبية — وهي شائعة في التوريد والرواتب — يُنتج
 * فرقاً بين يوم القيد ويوم السداد، وهذا الفرق مصروفٌ أو إيراد يجب أن يُثبت.
 *
 * ثلاثة مفاهيم لا تُخلط:
 *
 *  ـ **سعر الصرف**: كم وحدة من عملة الدفاتر تساوي وحدةً من العملة الأجنبية.
 *    يُقرأ بتاريخه — سعرُ اليوم لا يُطبَّق على قيد الشهر الماضي.
 *
 *  ـ **الفرق المحقَّق** (realized): ينشأ عند السداد الفعلي. فاتورةٌ بـ١٠٠٠
 *    يورو قُيّدت بسعر ٤٫١٠ وسُدِّدت بسعر ٤٫٢٠ ⇒ خسارةُ مئةِ ريال حقيقية خرجت
 *    من الخزينة. يُقيَّد مصروفاً أو إيراداً نهائياً.
 *
 *  ـ **الفرق غير المحقَّق** (unrealized): ينشأ من إعادة تقييم رصيدٍ قائم في
 *    نهاية الفترة. الرصيد لم يُسدَّد بعد، فالفرق تقديرٌ لا نقدٌ — ولذلك
 *    **يُعكس في أول اليوم التالي**، وإلا تراكم فرقٌ على فرقٍ وصار الرصيد
 *    بعد أشهر رقماً لا يقابله شيء.
 *
 * العكس التلقائي هو الفرق بين نظامٍ يحسب فروق العملة ونظامٍ يفسدها.
 */
import type { Tx } from '../db.ts';
import { d, money, Decimal, type Num } from '../money.ts';
import { DomainError, ValidationError } from '../errors.ts';
import { postEntry, accountByRole } from './posting.ts';
import { nextNumber } from './numbering.ts';

/**
 * يقرأ سعر الصرف في تاريخ بعينه.
 *
 * يأخذ آخر سعرٍ مُعلَن **في التاريخ أو قبله** — لا بعده. لأن قيد الأمس
 * يُقوَّم بسعر الأمس، ومن يأخذ آخر سعرٍ في الجدول يعيد تقييم الماضي بسعر
 * الحاضر في كل مرة يُفتح فيها تقرير قديم.
 */
export async function rateOn(
  tx: Tx,
  tenantId: string,
  currency: string,
  date: Date,
  baseCurrency = 'SAR',
): Promise<Decimal> {
  if (currency === baseCurrency) return new Decimal(1);

  const row = await tx.exchangeRate.findFirst({
    where: { tenantId, currency, date: { lte: date } },
    orderBy: { date: 'desc' },
  });

  if (!row) {
    throw new DomainError(
      `لا يوجد سعر صرف لعملة ${currency} في ${date.toISOString().slice(0, 10)} أو قبله. ` +
        `أضِف السعر قبل الترحيل بهذه العملة.`,
      'MISSING_FX_RATE',
      { currency, date },
    );
  }

  return d(row.rate);
}

export async function setRate(
  tx: Tx,
  tenantId: string,
  currency: string,
  date: Date,
  rate: Num,
) {
  const r = d(rate);
  if (!r.greaterThan(0)) throw new ValidationError('سعر الصرف يجب أن يكون موجباً.');

  return tx.exchangeRate.upsert({
    where: { tenantId_currency_date: { tenantId, currency, date } },
    create: { tenantId, currency, date, rate: r.toFixed(9) },
    update: { rate: r.toFixed(9) },
  });
}

/** يحوّل مبلغاً بعملة أجنبية إلى عملة الدفاتر بسعر يومه. */
export async function toBase(
  tx: Tx,
  tenantId: string,
  amount: Num,
  currency: string,
  date: Date,
): Promise<{ base: Decimal; rate: Decimal }> {
  const rate = await rateOn(tx, tenantId, currency, date);
  return { base: money(d(amount).times(rate)), rate };
}

/**
 * الفرق المحقَّق عند السداد.
 *
 * @param originalRate سعر يوم القيد الأصلي
 * @param settlementRate سعر يوم السداد
 * @returns موجب = ربح، سالب = خسارة. والاتجاه يعتمد على طبيعة البند:
 *          ارتفاع السعر يربح صاحبَ الذمّة المدينة ويخسر صاحبَ الدائنة.
 */
export function realizedDifference(
  foreignAmount: Num,
  originalRate: Num,
  settlementRate: Num,
  kind: 'RECEIVABLE' | 'PAYABLE',
): Decimal {
  const amount = d(foreignAmount);
  const delta = d(settlementRate).minus(d(originalRate));
  const raw = money(amount.times(delta));
  // الذمّة المدينة: ارتفاع السعر يزيد ما سنقبضه بعملة الدفاتر ⇒ ربح.
  // الذمّة الدائنة: ارتفاع السعر يزيد ما سندفعه ⇒ خسارة.
  return kind === 'RECEIVABLE' ? raw : raw.negated();
}

/**
 * يُثبت فرقاً محقَّقاً في الدفتر.
 *
 * يُستدعى من مسار السداد حين تختلف عملة الفاتورة عن عملة الدفاتر.
 */
export async function postRealizedDifference(
  tx: Tx,
  tenantId: string,
  input: {
    date: Date;
    difference: Num;
    /** الحساب المقابل — الذمم عادةً */
    counterAccountId: string;
    partnerId?: string | null;
    descAr: string;
    sourceType?: string;
    sourceId?: string;
    actor?: string;
  },
) {
  const diff = money(input.difference);
  if (diff.isZero()) return null;

  const gain = diff.greaterThan(0);
  const fxAccount = await accountByRole(tx, tenantId, gain ? 'OTHER_INCOME' : 'FX_DIFFERENCE');

  return postEntry(tx, tenantId, {
    date: input.date,
    memoAr: input.descAr,
    sourceType: input.sourceType ?? 'FX',
    sourceId: input.sourceId,
    createdBy: input.actor,
    lines: [
      {
        accountId: input.counterAccountId,
        [gain ? 'debit' : 'credit']: diff.abs(),
        descAr: input.descAr,
        partnerId: input.partnerId ?? null,
      },
      {
        accountId: fxAccount.id,
        [gain ? 'credit' : 'debit']: diff.abs(),
        descAr: gain ? 'ربح فروق عملة محقَّق' : 'خسارة فروق عملة محقَّقة',
        partnerId: input.partnerId ?? null,
      },
    ] as never,
  });
}

/**
 * معاينة إعادة التقييم: أي الحسابات بعملة أجنبية، وكم الفرق.
 *
 * تُقرأ الأرصدة من الحسابات التي لها `currency` مضبوطة — حساب بنك بالدولار
 * مثلاً. الحسابات بعملة الدفاتر لا تُعاد تقييمها لأن قيمتها لا تتغيّر.
 */
export async function previewRevaluation(
  tx: Tx,
  tenantId: string,
  valuationDate: Date,
) {
  const tenant = await tx.tenant.findFirstOrThrow({ where: { id: tenantId } });
  const base = tenant.baseCurrency;

  const accounts = await tx.account.findMany({
    where: {
      tenantId, isGroup: false, active: true,
      currency: { not: null },
    },
    orderBy: { code: 'asc' },
  });

  const lines: {
    accountId: string; code: string; nameAr: string; currency: string;
    bookValue: Decimal; rate: Decimal; revaluedValue: Decimal;
    foreignBalance: Decimal; difference: Decimal;
  }[] = [];

  for (const acc of accounts) {
    if (!acc.currency || acc.currency === base) continue;

    // القيمة الدفترية الحالية بعملة الدفاتر
    const agg = await tx.$queryRaw<{ debit: string; credit: string; fx: string }[]>`
      SELECT
        COALESCE(SUM(l."debit"), 0)::text  AS debit,
        COALESCE(SUM(l."credit"), 0)::text AS credit,
        COALESCE(SUM(COALESCE(l."currency", 0)), 0)::text AS fx
      FROM "JournalLine" l
      JOIN "JournalEntry" e ON e."id" = l."entryId"
      WHERE l."tenantId" = ${tenantId}
        AND l."accountId" = ${acc.id}
        AND e."status" IN ('POSTED', 'REVERSED')
        AND e."date" <= ${valuationDate}
    `;

    const bookValue = money(d(agg[0]?.debit).minus(d(agg[0]?.credit)));
    // الرصيد بالعملة الأجنبية مخزَّن في عمود `currency` بالسطر
    const foreignBalance = money(agg[0]?.fx ?? 0);

    if (bookValue.isZero() && foreignBalance.isZero()) continue;

    const rate = await rateOn(tx, tenantId, acc.currency, valuationDate, base);
    const revaluedValue = money(foreignBalance.times(rate));
    const difference = money(revaluedValue.minus(bookValue));

    if (difference.isZero()) continue;

    lines.push({
      accountId: acc.id, code: acc.code, nameAr: acc.nameAr,
      currency: acc.currency,
      bookValue, rate, revaluedValue, foreignBalance, difference,
    });
  }

  const netDifference = money(lines.reduce((s, l) => s.plus(l.difference), new Decimal(0)));

  return { valuationDate, baseCurrency: base, lines, netDifference };
}

/**
 * ينفّذ إعادة التقييم ويرحّل قيدها، ثم يعكسه في اليوم التالي.
 *
 * العكس هو جوهر العملية لا زينةً فيها: الفرق غير محقَّق، فإبقاؤه يجعل
 * الرصيد بعد أشهرٍ مجموعَ تقديراتٍ لا رصيداً حقيقياً. يُثبَت ليظهر في قوائم
 * نهاية الفترة، ثم يُرفع فوراً.
 */
export async function postRevaluation(
  tx: Tx,
  tenantId: string,
  valuationDate: Date,
  opts: { autoReverse?: boolean; actor?: string } = {},
) {
  const preview = await previewRevaluation(tx, tenantId, valuationDate);

  if (!preview.lines.length) {
    throw new ValidationError(
      'لا أرصدة بعملات أجنبية تحتاج إعادة تقييم في هذا التاريخ.',
    );
  }

  const number = await nextNumber(tx, tenantId, 'FX_REVALUATION', valuationDate);
  const autoReverse = opts.autoReverse !== false;

  const gainAcc = await accountByRole(tx, tenantId, 'OTHER_INCOME');
  const lossAcc = await accountByRole(tx, tenantId, 'FX_DIFFERENCE');

  const jLines: Record<string, unknown>[] = [];
  for (const l of preview.lines) {
    jLines.push({
      accountId: l.accountId,
      [l.difference.greaterThan(0) ? 'debit' : 'credit']: l.difference.abs(),
      descAr: `إعادة تقييم ${l.nameAr} بسعر ${l.rate.toFixed(4)}`,
    });
  }

  const net = preview.netDifference;
  if (!net.isZero()) {
    jLines.push({
      accountId: net.greaterThan(0) ? gainAcc.id : lossAcc.id,
      [net.greaterThan(0) ? 'credit' : 'debit']: net.abs(),
      descAr: net.greaterThan(0)
        ? 'ربح فروق عملة غير محقَّق'
        : 'خسارة فروق عملة غير محقَّقة',
    });
  }

  const entry = await postEntry(tx, tenantId, {
    date: valuationDate,
    memoAr: `إعادة تقييم أرصدة العملات الأجنبية — ${number}`,
    ref: number,
    sourceType: 'FX',
    sourceId: number,
    createdBy: opts.actor,
    lines: jLines as never,
  });

  // القيد العاكس في اليوم التالي — لا `reverseEntry` لأن ذاك يسم الأصل
  // «معكوساً» وهو ليس خطأً يُصحَّح، بل تقديرٌ يُرفع بانتهاء غرضه.
  let reversalId: string | null = null;
  if (autoReverse) {
    const nextDay = new Date(valuationDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const reversal = await postEntry(tx, tenantId, {
      date: nextDay,
      memoAr: `رفع إعادة تقييم ${number} — الفرق غير محقَّق`,
      ref: number,
      sourceType: 'FX',
      sourceId: `${number}-REV`,
      createdBy: opts.actor,
      lines: jLines.map((l) => ({
        accountId: l.accountId,
        debit: l.credit ?? 0,
        credit: l.debit ?? 0,
        descAr: `رفع: ${l.descAr}`,
      })) as never,
    });
    reversalId = reversal.id;
  }

  return tx.fxRevaluation.create({
    data: {
      tenantId, number, valuationDate,
      status: 'POSTED',
      netDifference: net.toFixed(6),
      accountCount: preview.lines.length,
      journalEntryId: entry.id,
      reversalEntryId: reversalId,
      autoReverse,
      postedAt: new Date(),
      createdBy: opts.actor ?? null,
      lines: {
        create: preview.lines.map((l) => ({
          tenantId,
          accountId: l.accountId,
          currency: l.currency,
          foreignBalance: l.foreignBalance.toFixed(6),
          bookValue: l.bookValue.toFixed(6),
          rate: l.rate.toFixed(9),
          revaluedValue: l.revaluedValue.toFixed(6),
          difference: l.difference.toFixed(6),
        })),
      },
    },
    include: { lines: true },
  });
}

/** تقرير الانكشاف: الأرصدة بالعملات الأجنبية وقيمتها الحالية. */
export async function currencyExposure(tx: Tx, tenantId: string, asOf: Date) {
  const preview = await previewRevaluation(tx, tenantId, asOf);

  const byCurrency = new Map<string, { foreign: Decimal; book: Decimal; revalued: Decimal }>();
  for (const l of preview.lines) {
    const cur = byCurrency.get(l.currency) ?? {
      foreign: new Decimal(0), book: new Decimal(0), revalued: new Decimal(0),
    };
    cur.foreign = cur.foreign.plus(l.foreignBalance);
    cur.book = cur.book.plus(l.bookValue);
    cur.revalued = cur.revalued.plus(l.revaluedValue);
    byCurrency.set(l.currency, cur);
  }

  return {
    asOf,
    baseCurrency: preview.baseCurrency,
    currencies: [...byCurrency.entries()].map(([currency, v]) => ({
      currency,
      foreignBalance: money(v.foreign),
      bookValue: money(v.book),
      currentValue: money(v.revalued),
      exposure: money(v.revalued.minus(v.book)),
    })),
    netExposure: preview.netDifference,
  };
}
